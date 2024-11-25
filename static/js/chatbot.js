// static/js/chatbot.js
const chatbox = document.getElementById('chatbox');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const docList = document.getElementById('docList');
const uploadProgress = document.getElementById('uploadProgress');
const progressBarFill = document.getElementById('progressBarFill');
const uploadStatus = document.getElementById('upload-status');

async function uploadFile() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];

    if (!file) {
        alert('Please select a file first.');
        return;
    }

    uploadProgress.style.display = 'block';
    progressBarFill.style.width = '0%';
    uploadStatus.textContent = 'Starting upload...';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await axios.post('/upload', formData, {
            onUploadProgress: (progressEvent) => {
                const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                progressBarFill.style.width = percentCompleted + '%';
                uploadStatus.textContent = `Uploading: ${percentCompleted}%`;
            }
        });

        if (response.data.success) {
            uploadStatus.textContent = 'File uploaded and processed successfully!';
            addMessage('System', `File "${response.data.file_name}" has been uploaded and processed.`);
            fileInput.value = '';
        } else {
            uploadStatus.textContent = 'Upload failed: ' + response.data.error;
        }
    } catch (error) {
        console.error('Upload error:', error);
        uploadStatus.textContent = 'Upload failed: ' + (error.response?.data?.error || error.message);
    }

    setTimeout(() => {
        uploadProgress.style.display = 'none';
    }, 3000);
}

function addMessage(sender, message) {
    const messageElement = document.createElement('p');
    messageElement.className = `message ${sender.toLowerCase()}-message`;
    messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
    chatbox.appendChild(messageElement);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function updateRelevantDocs(documents) {
    docList.innerHTML = '';

    if (!documents || documents.length === 0) {
        docList.innerHTML = '<li>No relevant documents found</li>';
        return;
    }

    documents.forEach(doc => {
        const li = document.createElement('li');
        li.className = 'doc-item';
        
        // Document link container
        const linkContainer = document.createElement('div');
        const link = document.createElement('span');
        link.className = 'doc-link';
        link.innerHTML = `${doc.file_name} <br><small>${doc.source}</small>`;
        link.onclick = () => openDocument(doc.file_id);
        linkContainer.appendChild(link);
        
        // Delete button
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = () => deleteDocument(doc.file_id, doc.file_name);
        
        li.appendChild(linkContainer);
        li.appendChild(deleteBtn);
        docList.appendChild(li);
    });
}

function openDocument(fileId) {
    if (!fileId || fileId === 'Unknown') {
        console.error('Invalid file ID provided');
        alert('Cannot open document: Invalid file ID');
        return;
    }

    const loadingMsg = document.createElement('div');
    loadingMsg.id = 'loading-' + fileId;
    loadingMsg.textContent = 'Opening document...';
    document.body.appendChild(loadingMsg);

    axios.get(`/open_document/${fileId}`)
        .then(function (response) {
            if (response.data.download_url) {
                window.open(response.data.download_url, '_blank');
            } else {
                throw new Error('No download URL in response');
            }
        })
        .catch(function (error) {
            alert('Failed to open document');
        })
        .finally(function() {
            const loadingElement = document.getElementById('loading-' + fileId);
            if (loadingElement) {
                loadingElement.remove();
            }
        });
}

async function deleteDocument(fileId, fileName) {
    if (!confirm(`Are you sure you want to delete "${fileName}"?`)) {
        return;
    }

    try {
        const response = await axios.delete(`/delete_file/${fileId}`);
        if (response.data.success) {
            // Remove the document from the list
            const docElement = Array.from(docList.children).find(
                li => li.querySelector('.doc-link').onclick.toString().includes(fileId)
            );
            if (docElement) {
                docElement.remove();
            }
            addMessage('System', `File "${fileName}" has been deleted successfully.`);
        } else {
            throw new Error(response.data.error || 'Unknown error occurred');
        }
    } catch (error) {
        console.error('Delete error:', error);
        let errorMessage = error.response?.data?.error || error.message;
        
        // Handle specific status codes
        if (error.response?.status === 404) {
            errorMessage = `File "${fileName}" not found or already deleted`;
            // Remove the document from the list since it doesn't exist
            const docElement = Array.from(docList.children).find(
                li => li.querySelector('.doc-link').onclick.toString().includes(fileId)
            );
            if (docElement) {
                docElement.remove();
            }
        } else if (error.response?.status === 403) {
            errorMessage = 'You do not have permission to delete this file';
        }
        
        addMessage('System', `Failed to delete "${fileName}": ${errorMessage}`);
    }
}

sendButton.onclick = function() {
    const message = userInput.value;
    if (message) {
        addMessage('You', message);
        axios.post('/chat', { query: message })
            .then(function (response) {
                addMessage('Bot', response.data.response);
                updateRelevantDocs(response.data.relevant_documents);
            })
            .catch(function (error) {
                addMessage('Bot', 'Sorry, an error occurred.');
            });
        userInput.value = '';
    }
};

userInput.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendButton.click();
    }
});
