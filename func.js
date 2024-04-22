const { jellyfinServerUrl, apiToken, bookLibraryId, userId } = CONFIG;

let currentRendition = null; 

async function fetchAllBooks() {
    console.log('Fetching books...');
    const url = `${jellyfinServerUrl}/Items?parentId=${bookLibraryId}&IncludeItemTypes=Book&api_key=${apiToken}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `MediaBrowser Token=${apiToken}`,
            },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        displayBooks(data.Items);
    } catch (error) {
        console.error('Failed to fetch books:', error);
    }
}

function displayBooks(books) {
    const grid = document.getElementById('booksGrid');
    grid.innerHTML = '';
    books.forEach(book => {
        const card = document.createElement('div');
        card.className = 'card';
        card.addEventListener('click', () => showBookModal(book.Id));

        const imgContainer = document.createElement('div');
        imgContainer.className = 'image-container';

        const img = document.createElement('img');
        img.src = book.ImageTags && book.ImageTags.Primary ? `${jellyfinServerUrl}/Items/${book.Id}/Images/Primary` : 'https://via.placeholder.com/150';
        img.alt = 'Book Cover';
        img.className = 'book-cover'

        const hoverImg = document.createElement('img');
        hoverImg.src = img.src;
        hoverImg.alt = 'Book Cover Hover';
        hoverImg.className = 'book-cover-hover';

        imgContainer.appendChild(img);
        imgContainer.appendChild(hoverImg);

        const title = document.createElement('p');
        title.textContent = book.Name;
       
        const playButton = document.createElement('button');
        playButton.className = 'play-button';
        playButton.addEventListener('click', (event) => {
            event.stopPropagation();
            startReadingBook(book.Id);
        });

        card.appendChild(imgContainer);
        card.appendChild(title);
        card.appendChild(playButton);

        grid.appendChild(card);
    });
}

async function showBookModal(bookId) {
    const bookDetails = await fetchBookDetails(bookId);
    if (!bookDetails) {
        console.error(`Failed to fetch book details for: ${bookId}`);
        return;
    }

    const coverUrl = bookDetails.ImageTags && bookDetails.ImageTags.Primary 
        ? `${jellyfinServerUrl}/Items/${bookDetails.Id}/Images/Backdrop?api_key=${apiToken}` 
        : '';
    
    const modalContent = document.querySelector('.modal-content');
    modalContent.style.backgroundImage = `url('${coverUrl}')`;
    const img = new Image();

    img.onload = function() {
        const aspectRatio = this.width / this.height;
        const maxHeight = window.innerHeight * 0.96;
        const maxWidth = window.innerWidth * 0.96;

        let imgHeight = Math.min(this.height, maxHeight);
        let imgWidth = imgHeight * aspectRatio;

        if (imgWidth > maxWidth) {
            imgWidth = maxWidth;
            imgHeight = imgWidth / aspectRatio;
        }

        modalContent.style.width = `${imgWidth}px`;
        modalContent.style.height = `${imgHeight}px`;
        modalContent.style.backgroundImage = `url('${coverUrl}')`;
    };

    img.src = coverUrl;

    document.querySelector('.modal-content').style.backgroundImage = `url('${getCoverUrl(bookDetails)}')`;
    document.getElementById('modalBookTitle').textContent = bookDetails.Name || 'Unknown Book';
    document.getElementById('modalBookOverview').innerHTML = formatOverview(bookDetails.Overview || 'No description available.');
    document.getElementById('modalBookYear').textContent = `Published: ${bookDetails.ProductionYear || 'N/A'}`;

    document.getElementById('bookModal').style.display = 'block';
}

function getCoverUrl(bookDetails) {
    return bookDetails.coverImageUrl || '';
}

function formatOverview(overview) {
     return overview.replace(/{\/ln}/g, '<span class="tall-break"></span><br>');
}
// Handle closing the modal
window.onclick = function(event) {
    const bookModal = document.getElementById('bookModal');
    const readerModal = document.getElementById('bookReaderModal');
    if (event.target == bookModal) {
        bookModal.style.display = "none";
    } else if (event.target == readerModal) {
        readerModal.style.display = "none";
    }
}

async function fetchBookDetails(bookId) {
    const url = `${jellyfinServerUrl}/Users/${userId}/Items/${bookId}`;
    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `MediaBrowser Token=${apiToken}`,
            },
        });
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (error) {
        console.error('Failed to fetch book details:', error);
        return null;
    }
}

async function startReadingBook(bookId) {
    console.log("Attempting to open book reader modal...");
    const bookUrl = `https://media.kickfresh.shop/Items/${bookId}/Download?api_key=dd75c64377664fc1995c34d32992a5e9`;

    const viewer = document.getElementById('bookViewer');
    const bookModal = document.getElementById('bookReaderModal');
    bookModal.style.display = 'block';

    // Clear the previous viewer content, especially if there was a book loaded before
    viewer.innerHTML = '';

    try {
        const response = await fetch(bookUrl);
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        const bookBlob = await response.blob();

        // Destroy the previous rendition if it exists
        if (currentRendition) {
            currentRendition.destroy();
        }

        // Initialize ePub.js with the Blob
        const book = ePub(bookBlob);
        currentRendition = book.renderTo("bookViewer", {
            width: "100%",
            height: "100%",
            spread: "none",  // Ensures only one page is visible
            minSpreadWidth: 9999  // Essentially disables spreads
        });

        currentRendition.display().then(function() {
            initializeReadingPosition(bookId, currentRendition);
        }).catch(error => {
            console.error("Error displaying the book:", error);
        });

    } catch (error) {
        console.error('Failed to fetch or display book:', error);
        bookModal.style.display = 'none'; // Hide modal on failure
    }
}

function initializeReadingPosition(bookId, rendition) {
    const savedPosition = localStorage.getItem('bookPosition-' + bookId);
    if (savedPosition) {
        rendition.display(savedPosition);
    }
    rendition.on('relocated', function(location){
        localStorage.setItem('bookPosition-' + bookId, location.start.cfi);
    });
}

function closeReader() {
    const bookModal = document.getElementById('bookReaderModal');
    bookModal.style.display = 'none';

    // Optionally, clear the viewer content and destroy the current rendition when closing
    if (currentRendition) {
        currentRendition.destroy();
        currentRendition = null;
    }
    document.getElementById('bookViewer').innerHTML = ''; // Clean up the viewer content
}
