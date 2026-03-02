// Global variables
let authorizeButton = document.getElementById('authorizeButton');
let signoutButton = document.getElementById('signoutButton');
let uploadArea = document.getElementById('uploadArea');
let fileInput = document.getElementById('fileInput');
let selectBtn = document.getElementById('selectBtn');
let galleryGrid = document.getElementById('galleryGrid');
let refreshBtn = document.getElementById('refreshGallery');
let imageModal = document.getElementById('imageModal');
let modalImage = document.getElementById('modalImage');
let modalCaption = document.getElementById('modalCaption');
let modalClose = document.getElementById('modalClose');

// Initialize Google API
function handleClientLoad() {
    gapi.load('client:auth2', initClient);
}

function initClient() {
    gapi.client.init({
        apiKey: CONFIG.API_KEY,
        clientId: CONFIG.CLIENT_ID,
        discoveryDocs: CONFIG.DISCOVERY_DOCS,
        scope: CONFIG.SCOPES
    }).then(function () {
        // Listen for sign-in state changes
        gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);
        
        // Handle initial sign-in state
        updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());
        
        authorizeButton.onclick = handleAuthClick;
        signoutButton.onclick = handleSignoutClick;
    }, function(error) {
    console.error("FULL ERROR:", JSON.stringify(error, null, 2));
    alert(JSON.stringify(error, null, 2));
});
}

function updateSigninStatus(isSignedIn) {
    if (isSignedIn) {
        authorizeButton.style.display = 'none';
        signoutButton.style.display = 'inline-block';
        loadGalleryPhotos();
        enableUpload();
    } else {
        authorizeButton.style.display = 'inline-block';
        signoutButton.style.display = 'none';
        disableUpload();
        galleryGrid.innerHTML = '<div class="loading-message">Please sign in to view and upload photos</div>';
    }
}

function handleAuthClick() {
    gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick() {
    gapi.auth2.getAuthInstance().signOut();
}

// Upload functionality
function enableUpload() {
    uploadArea.style.opacity = '1';
    uploadArea.style.pointerEvents = 'auto';
    
    // File input change
    fileInput.addEventListener('change', handleFileSelect);
    
    // Click to select files
    selectBtn.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('click', (e) => {
        if (e.target === uploadArea || e.target.parentElement === uploadArea) {
            fileInput.click();
        }
    });
    
    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', () => {
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        handleFileSelect({ target: { files: e.dataTransfer.files } });
    });
}

function disableUpload() {
    uploadArea.style.opacity = '0.5';
    uploadArea.style.pointerEvents = 'none';
}

function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    
    if (files.length === 0) return;
    
    // Filter only image files
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length === 0) {
        showNotification('Please select valid image files', 'error');
        return;
    }
    
    uploadFiles(imageFiles);
}

async function uploadFiles(files) {
    const uploadProgress = document.getElementById('uploadProgress');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    uploadProgress.style.display = 'block';
    
    let uploaded = 0;
    const total = files.length;
    
    for (let file of files) {
        try {
            progressText.textContent = `Uploading ${file.name}...`;
            await uploadFile(file);
            uploaded++;
            const percent = (uploaded / total) * 100;
            progressFill.style.width = percent + '%';
        } catch (error) {
            console.error('Upload error:', error);
            showNotification(`Failed to upload ${file.name}`, 'error');
        }
    }
    
    progressText.textContent = `Successfully uploaded ${uploaded} of ${total} files!`;
    
    setTimeout(() => {
        uploadProgress.style.display = 'none';
        progressFill.style.width = '0%';
        loadGalleryPhotos(); // Refresh gallery
    }, 2000);
    
    // Clear file input
    fileInput.value = '';
}

function uploadFile(file) {
    return new Promise((resolve, reject) => {
        const metadata = {
            'name': file.name,
            'mimeType': file.type,
            'parents': [CONFIG.FOLDER_ID]
        };
        
        const form = new FormData();
        form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
        form.append('file', file);
        
        fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id', {
            method: 'POST',
            headers: new Headers({ 'Authorization': 'Bearer ' + gapi.auth.getToken().access_token }),
            body: form
        })
        .then(response => response.json())
        .then(data => {
            if (data.error) {
                reject(data.error);
            } else {
                resolve(data);
            }
        })
        .catch(error => reject(error));
    });
}

// Gallery functionality
async function loadGalleryPhotos() {
    galleryGrid.innerHTML = '<div class="loading-message">Loading photos...</div>';
    
    try {
        const response = await gapi.client.drive.files.list({
            'pageSize': 100,
            'fields': 'nextPageToken, files(id, name, mimeType, thumbnailLink, webContentLink)',
            'q': `'${CONFIG.FOLDER_ID}' in parents and mimeType contains 'image/' and trashed = false`,
            'orderBy': 'createdTime desc'
        });
        
        const files = response.result.files;
        
        if (files && files.length > 0) {
            displayPhotos(files);
        } else {
            galleryGrid.innerHTML = '<div class="loading-message">No photos found. Upload some photos to get started!</div>';
        }
    } catch (error) {
        console.error('Error loading photos:', error);
        galleryGrid.innerHTML = '<div class="loading-message">Error loading photos. Please try again.</div>';
    }
}

function displayPhotos(files) {
    galleryGrid.innerHTML = '';
    
    files.forEach(file => {
        const photoItem = document.createElement('div');
        photoItem.className = 'photo-item';
        
        // Create image element
        const img = document.createElement('img');
        img.src = `https://drive.google.com/uc?export=view&id=${file.id}`;
        img.alt = file.name;
        img.loading = 'lazy';
        
        // Create name overlay
        const nameOverlay = document.createElement('div');
        nameOverlay.className = 'photo-name';
        nameOverlay.textContent = file.name;
        
        photoItem.appendChild(img);
        photoItem.appendChild(nameOverlay);
        
        // Click to view full image
        photoItem.addEventListener('click', () => {
            openModal(file);
        });
        
        galleryGrid.appendChild(photoItem);
    });
}

// Modal functionality
function openModal(file) {
    imageModal.style.display = 'block';
    modalImage.src = `https://drive.google.com/uc?export=view&id=${file.id}`;
    modalCaption.textContent = file.name;
}

modalClose.onclick = function() {
    imageModal.style.display = 'none';
}

imageModal.onclick = function(e) {
    if (e.target === imageModal) {
        imageModal.style.display = 'none';
    }
}

// Refresh gallery
refreshBtn.addEventListener('click', () => {
    if (gapi.auth2.getAuthInstance().isSignedIn.get()) {
        loadGalleryPhotos();
    }
});

// Notification function
function showNotification(message, type) {
    // You can implement a toast notification here
    console.log(`${type}: ${message}`);
    alert(message);
}

// Initialize on load
document.addEventListener("DOMContentLoaded", function() {
    handleClientLoad();
});
