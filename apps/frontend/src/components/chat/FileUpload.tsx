import React, { useState, useRef, useCallback } from 'react';
import { Upload, X, FileText, Image, Video, Code, File } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import {
  uploadFile,
  uploadMultipleFiles,
  UploadProgress,
  UploadedFile,
  getFileCategory,
  formatFileSize,
  isFileSizeValid,
} from '../../services/fileUpload.service';

interface FileUploadProps {
  onFilesUploaded: (files: UploadedFile[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  allowedTypes?: string[];
}

interface FilePreview {
  file: File;
  preview: string | null;
  category: 'image' | 'video' | 'document' | 'code' | 'other';
  size: string;
  id: string;
}

export const FileUpload: React.FC<FileUploadProps> = ({
  onFilesUploaded,
  maxFiles = 5,
  maxSizeMB = 100,
  allowedTypes = [],
}) => {
  const [previews, setPreviews] = useState<FilePreview[]>([]);
  const [uploads, setUploads] = useState<Record<string, UploadProgress>>({});
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const sessionId = useSelector((state: RootState) => state.session.currentSession?.id);

  const createPreview = useCallback((file: File): FilePreview => {
    const id = `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const category = getFileCategory(file.type);
    let preview: string | null = null;

    if (category === 'image' && file.type !== 'image/svg+xml') {
      preview = URL.createObjectURL(file);
    }

    return {
      file,
      preview,
      category,
      size: formatFileSize(file.size),
      id,
    };
  }, []);

  const handleFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);

      if (previews.length + fileArray.length > maxFiles) {
        alert(`You can only upload up to ${maxFiles} files at a time`);
        return;
      }

      const validFiles = fileArray.filter((file) => {
        if (!isFileSizeValid(file.size, maxSizeMB)) {
          alert(`File "${file.name}" exceeds the ${maxSizeMB}MB size limit`);
          return false;
        }

        if (allowedTypes.length > 0 && !allowedTypes.includes(file.type)) {
          alert(`File type "${file.type}" is not allowed`);
          return false;
        }

        return true;
      });

      const newPreviews = validFiles.map(createPreview);
      setPreviews((prev) => [...prev, ...newPreviews]);
    },
    [previews.length, maxFiles, maxSizeMB, allowedTypes, createPreview]
  );

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      handleFiles(e.target.files);
    }
  };

  const removePreview = (id: string) => {
    setPreviews((prev) => {
      const preview = prev.find((p) => p.id === id);
      if (preview?.preview) {
        URL.revokeObjectURL(preview.preview);
      }
      return prev.filter((p) => p.id !== id);
    });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'image':
        return <Image size={24} className="text-pink-500" />;
      case 'video':
        return <Video size={24} className="text-purple-500" />;
      case 'document':
        return <FileText size={24} className="text-blue-500" />;
      case 'code':
        return <Code size={24} className="text-green-500" />;
      default:
        return <File size={24} className="text-gray-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'image':
        return 'bg-pink-100 border-pink-300 dark:bg-pink-900 dark:border-pink-700';
      case 'video':
        return 'bg-purple-100 border-purple-300 dark:bg-purple-900 dark:border-purple-700';
      case 'document':
        return 'bg-blue-100 border-blue-300 dark:bg-blue-900 dark:border-purple-700';
      case 'code':
        return 'bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700';
      default:
        return 'bg-gray-100 border-gray-300 dark:bg-gray-800 dark:border-gray-700';
    }
  };

  const uploadAll = async () => {
    if (!sessionId) {
      alert('No active session');
      return;
    }

    try {
      const uploadedFiles = await uploadMultipleFiles(
        previews.map((p) => p.file),
        sessionId,
        (progress) => {
          setUploads((prev) => ({
            ...prev,
            [progress.fileId]: progress,
          }));
        }
      );

      onFilesUploaded(uploadedFiles);
      setPreviews([]);
      setUploads({});
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Failed to upload files');
    }
  };

  const isUploading = Object.values(uploads).some((u) => u.status === 'uploading');
  const hasError = Object.values(uploads).some((u) => u.status === 'error');
  const allSuccess = Object.values(uploads).length === previews.length &&
    Object.values(uploads).every((u) => u.status === 'success');

  return (
    <div className="space-y-4">
      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-600'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          className="hidden"
          id="file-upload-input"
        />
        <Upload className="mx-auto mb-4 text-gray-400" size={48} />
        <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
          Drag and drop files here, or click to browse
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Max {maxFiles} files, up to {maxSizeMB}MB each
        </p>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Select Files
        </button>
      </div>

      {previews.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900 dark:text-gray-100">
            Selected Files ({previews.length})
          </h4>
          {previews.map((preview) => (
            <div
              key={preview.id}
              className={`flex items-center gap-4 p-4 rounded-lg border ${getCategoryColor(preview.category)}`}
            >
              <div className="flex-shrink-0">
                {preview.preview ? (
                  <img
                    src={preview.preview}
                    alt={preview.file.name}
                    className="w-16 h-16 object-cover rounded"
                  />
                ) : (
                  <div className="w-16 h-16 flex items-center justify-center bg-white dark:bg-gray-800 rounded">
                    {getCategoryIcon(preview.category)}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 dark:text-gray-100 truncate">
                  {preview.file.name}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">{preview.size}</p>
              </div>
              <button
                onClick={() => removePreview(preview.id)}
                className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                disabled={isUploading}
              >
                <X size={20} />
              </button>
            </div>
          ))}

          {!isUploading && !allSuccess && !hasError && (
            <button
              onClick={uploadAll}
              className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
            >
              Upload {previews.length} File{previews.length > 1 ? 's' : ''}
            </button>
          )}

          {isUploading && (
            <div className="space-y-2">
              {Object.values(uploads).map((upload) => (
                <div key={upload.fileId} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700 dark:text-gray-300 truncate">
                      {upload.fileName}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      {upload.progress}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${upload.progress}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          {allSuccess && (
            <div className="text-center text-green-600 dark:text-green-400 font-medium">
              ✓ All files uploaded successfully!
            </div>
          )}

          {hasError && (
            <div className="text-center text-red-600 dark:text-red-400 font-medium">
              ✗ Some uploads failed. Please try again.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
