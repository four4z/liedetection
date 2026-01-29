import { useState, useRef } from 'react';
import './VideoUploader.css';

export default function VideoUploader({ onUpload, isUploading }) {
    const [dragActive, setDragActive] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const inputRef = useRef(null);

    const allowedTypes = ['video/mp4', 'video/avi', 'video/mov', 'video/webm', 'video/x-matroska'];

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);

        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    };

    const handleChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    };

    const handleFile = (file) => {
        if (!allowedTypes.includes(file.type)) {
            alert('Please upload a video file (MP4, AVI, MOV, WebM, MKV)');
            return;
        }

        if (file.size > 100 * 1024 * 1024) {
            alert('File too large. Maximum size is 100MB.');
            return;
        }

        setSelectedFile(file);
    };

    const handleUpload = () => {
        if (selectedFile && onUpload) {
            onUpload(selectedFile);
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return (
        <div className="video-uploader">
            <div
                className={`upload-zone ${dragActive ? 'drag-active' : ''} ${selectedFile ? 'has-file' : ''}`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => inputRef.current?.click()}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept="video/*"
                    onChange={handleChange}
                    style={{ display: 'none' }}
                />

                {selectedFile ? (
                    <div className="file-preview">
                        <div className="file-icon">🎬</div>
                        <div className="file-info">
                            <p className="file-name">{selectedFile.name}</p>
                            <p className="file-size">{formatFileSize(selectedFile.size)}</p>
                        </div>
                        <button
                            className="remove-file"
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedFile(null);
                            }}
                        >
                            ✕
                        </button>
                    </div>
                ) : (
                    <div className="upload-prompt">
                        <div className="upload-icon">📤</div>
                        <p className="upload-text">
                            <span className="upload-primary">Drop your video here</span>
                            <span className="upload-secondary">or click to browse</span>
                        </p>
                        <p className="upload-hint">MP4, AVI, MOV, WebM, MKV • Max 100MB</p>
                    </div>
                )}
            </div>

            {selectedFile && (
                <button
                    className="btn btn-primary upload-button"
                    onClick={handleUpload}
                    disabled={isUploading}
                >
                    {isUploading ? (
                        <>
                            <span className="loader"></span>
                            Uploading...
                        </>
                    ) : (
                        <>
                            <span>🔍</span>
                            Analyze Video
                        </>
                    )}
                </button>
            )}
        </div>
    );
}
