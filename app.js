const API_KEY = 'a8e7b3dd';
const BASE_URL = 'https://www.omdbapi.com/';

const elements = {
    searchInput: document.getElementById('searchInput'),
    autocompleteList: document.getElementById('autocompleteList'),
    yearFilter: document.getElementById('yearFilter'),
    genreFilter: document.getElementById('genreFilter'),
    ratingFilter: document.getElementById('ratingFilter'),
    moviesGrid: document.getElementById('moviesGrid'),
    errorContainer: document.getElementById('errorContainer'),
    loadMoreBtn: document.getElementById('loadMoreBtn'),
    pagination: document.getElementById('pagination'),
    tabSearch: document.getElementById('tabSearch'),
    tabWatchlist: document.getElementById('tabWatchlist'),
    searchSection: document.getElementById('searchSection'),
    watchlistSection: document.getElementById('watchlistSection'),
    watchlistGrid: document.getElementById('watchlistGrid'),
    movieModal: document.getElementById('movieModal'),
    modalBody: document.getElementById('modalBody'),
    recommendationsSection: document.getElementById('recommendationsSection'),
    recommendationsGrid: document.getElementById('recommendationsGrid'),
    closeBtn: document.querySelector('.close-btn')
};

const appState = {
    currentPage: 1,
    currentQuery: '',
    watchlist: JSON.parse(localStorage.getItem('watchlist')) || []
};

function debounce(func, delay) {
    let timeoutId;
    return function (...args) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

function populateYearFilter() {
    const currentYear = new Date().getFullYear();
    for (let i = currentYear; i >= 1900; i--) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = i;
        elements.yearFilter.appendChild(option);
    }
}

function renderSkeletons(count = 10) {
    elements.moviesGrid.innerHTML = '';
    for (let i = 0; i < count; i++) {
        elements.moviesGrid.innerHTML += `<div class="movie-card skeleton-card"><div class="skeleton skeleton-img"></div></div>`;
    }
}

async function fetchAutocomplete(query) {
    if (!query) {
        elements.autocompleteList.classList.add('hidden');
        return;
    }
    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}`);
        const data = await response.json();
        
        if (data.Response === "True") {
            const suggestions = data.Search.slice(0, 5);
            elements.autocompleteList.innerHTML = suggestions.map(movie => `
                <li onclick="selectAutocomplete('${movie.Title}')">
                    <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/30x45'}" alt="poster">
                    <span>${movie.Title} (${movie.Year})</span>
                </li>
            `).join('');
            elements.autocompleteList.classList.remove('hidden');
        } else {
            elements.autocompleteList.classList.add('hidden');
        }
    } catch (error) {
        console.error("Autocomplete error:", error);
    }
}

function selectAutocomplete(title) {
    elements.searchInput.value = title;
    elements.autocompleteList.classList.add('hidden');
    appState.currentQuery = title;
    appState.currentPage = 1;
    searchMovies(title, 1);
}

async function searchMovies(query, page = 1, append = false) {
    if (!query) return;

    try {
        if (!append) {
            renderSkeletons();
            elements.errorContainer.classList.add('hidden');
        }

        const yearParam = elements.yearFilter.value ? `&y=${elements.yearFilter.value}` : '';
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(query)}&page=${page}${yearParam}`);
        const data = await response.json();

        if (data.Response === "False") throw new Error(data.Error);

        let moviesToRender = data.Search;

        const genre = elements.genreFilter.value;
        const rating = elements.ratingFilter.value;

        if (genre || rating) {
            const detailedMovies = await Promise.all(
                moviesToRender.map(async (movie) => {
                    const detailResponse = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${movie.imdbID}`);
                    return await detailResponse.json();
                })
            );

            moviesToRender = detailedMovies.filter(m => {
                const matchGenre = !genre || (m.Genre && m.Genre.includes(genre));
                const matchRating = !rating || (m.imdbRating !== 'N/A' && parseFloat(m.imdbRating) >= parseFloat(rating));
                return matchGenre && matchRating;
            });
        }

        renderMovies(moviesToRender, append);
        
        if (data.totalResults > page * 10 && !genre && !rating) {
            elements.pagination.classList.remove('hidden');
        } else {
            elements.pagination.classList.add('hidden'); 
        }

    } catch (error) {
        if (!append) elements.moviesGrid.innerHTML = '';
        elements.errorContainer.textContent = `Помилка: ${error.message}`;
        elements.errorContainer.classList.remove('hidden');
        elements.pagination.classList.add('hidden');
    }
}

function renderMovies(movies, append = false) {
    const html = movies.map(movie => `
        <div class="movie-card" onclick="fetchMovieDetails('${movie.imdbID}')">
            <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300x450?text=No+Poster'}" alt="${movie.Title}">
            <div class="movie-info">
                <h3>${movie.Title}</h3>
                <p>${movie.Year}</p>
            </div>
        </div>
    `).join('');

    if (append) elements.moviesGrid.innerHTML += html;
    else elements.moviesGrid.innerHTML = html || '<p style="padding: 20px;">Фільмів за цими критеріями не знайдено.</p>';
}

async function fetchMovieDetails(id) {
    try {
        elements.modalBody.innerHTML = '<div class="skeleton skeleton-img" style="width: 200px;"></div>';
        elements.recommendationsSection.classList.add('hidden');
        elements.movieModal.classList.remove('hidden');

        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&i=${id}&plot=full`);
        const movie = await response.json();
        const isSaved = appState.watchlist.some(m => m.imdbID === movie.imdbID);

        elements.modalBody.innerHTML = `
            <div class="modal-flex">
                <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300'}" alt="Poster" style="max-width: 200px; border-radius: 5px;">
                <div>
                    <h2>${movie.Title} (${movie.Year})</h2>
                    <p><strong>Рейтинг IMDb:</strong> ⭐ ${movie.imdbRating}</p>
                    <p><strong>Жанр:</strong> ${movie.Genre}</p>
                    <p><strong>Актори:</strong> ${movie.Actors}</p>
                    <p><strong>Опис:</strong> ${movie.Plot}</p>
                    <button onclick="toggleWatchlist('${movie.imdbID}', '${movie.Title.replace(/'/g, "\\'")}', '${movie.Poster}')" 
                            style="margin-top: 15px; background-color: ${isSaved ? '#555' : 'var(--accent)'}">
                        ${isSaved ? 'Видалити з Watchlist' : 'Додати у Watchlist'}
                    </button>
                </div>
            </div>
        `;
        const firstWord = movie.Title.split(' ')[0].replace(/[^a-zA-Z0-9]/g, '');
        fetchRecommendations(firstWord, id);

    } catch (error) {
        elements.modalBody.innerHTML = `<p style="color:red">Помилка завантаження: ${error.message}</p>`;
    }
}

async function fetchRecommendations(keyword, currentId) {
    try {
        const response = await fetch(`${BASE_URL}?apikey=${API_KEY}&s=${encodeURIComponent(keyword)}&type=movie`);
        const data = await response.json();
        
        if (data.Response === "True") {
            const recs = data.Search.filter(m => m.imdbID !== currentId).slice(0, 4);
            if (recs.length > 0) {
                elements.recommendationsGrid.innerHTML = recs.map(movie => `
                    <div class="rec-card" onclick="fetchMovieDetails('${movie.imdbID}')">
                        <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/120x180'}" alt="${movie.Title}">
                        <p style="font-size: 12px; margin: 5px 0;">${movie.Title}</p>
                    </div>
                `).join('');
                elements.recommendationsSection.classList.remove('hidden');
            }
        }
    } catch (error) {
        console.error("Recommendations error:", error);
    }
}

function toggleWatchlist(id, title, poster) {
    const index = appState.watchlist.findIndex(m => m.imdbID === id);
    if (index === -1) {
        appState.watchlist.push({ imdbID: id, Title: title, Poster: poster });
    } else {
        appState.watchlist.splice(index, 1);
    }
    localStorage.setItem('watchlist', JSON.stringify(appState.watchlist));
    fetchMovieDetails(id);
    renderWatchlist();
}

function renderWatchlist() {
    elements.watchlistGrid.innerHTML = appState.watchlist.map(movie => `
        <div class="movie-card">
            <img src="${movie.Poster !== 'N/A' ? movie.Poster : 'https://via.placeholder.com/300'}" alt="${movie.Title}" onclick="fetchMovieDetails('${movie.imdbID}')">
            <div class="movie-info">
                <h3>${movie.Title}</h3>
                <button onclick="toggleWatchlist('${movie.imdbID}', '', '')" style="margin-top: 5px; width: 100%;">Видалити</button>
            </div>
        </div>
    `).join('');
    if(appState.watchlist.length === 0) {
        elements.watchlistGrid.innerHTML = '<p>Ваш список порожній</p>';
    }
}

const handleInput = debounce((e) => {
    fetchAutocomplete(e.target.value.trim());
}, 300);

const handleSearchAction = () => {
    elements.autocompleteList.classList.add('hidden');
    appState.currentQuery = elements.searchInput.value.trim();
    appState.currentPage = 1;
    searchMovies(appState.currentQuery, appState.currentPage);
};

elements.searchInput.addEventListener('input', handleInput);
elements.searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') handleSearchAction();
});

document.addEventListener('click', (e) => {
    if (!elements.searchInput.contains(e.target) && !elements.autocompleteList.contains(e.target)) {
        elements.autocompleteList.classList.add('hidden');
    }
});

elements.yearFilter.addEventListener('change', handleSearchAction);
elements.genreFilter.addEventListener('change', handleSearchAction);
elements.ratingFilter.addEventListener('change', handleSearchAction);

elements.loadMoreBtn.addEventListener('click', () => {
    appState.currentPage++;
    searchMovies(appState.currentQuery, appState.currentPage, true);
});

elements.tabSearch.addEventListener('click', () => {
    elements.tabSearch.classList.add('active');
    elements.tabWatchlist.classList.remove('active');
    elements.searchSection.classList.remove('hidden');
    elements.watchlistSection.classList.add('hidden');
});

elements.tabWatchlist.addEventListener('click', () => {
    elements.tabWatchlist.classList.add('active');
    elements.tabSearch.classList.remove('active');
    elements.watchlistSection.classList.remove('hidden');
    elements.searchSection.classList.add('hidden');
    renderWatchlist();
});

elements.closeBtn.addEventListener('click', () => elements.movieModal.classList.add('hidden'));

populateYearFilter();
renderWatchlist();