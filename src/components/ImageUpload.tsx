import React, { useState, useCallback, useRef } from 'react';
import { uploadMistakeImage, compressImage } from '../utils/firebase';
import { getCurrentUser } from '../utils/firebase';
import { IoCloudUpload, IoClose, IoImage, IoCheckmarkCircle } from 'react-icons/io5';
import toast from 'react-hot-toast';

interface ImageUploadProps {
  onImageUploaded: (imageUrl: string) => void;
  currentImageUrl?: string;
  onImageRemoved?: () => void;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  onImageUploaded,
  currentImageUrl,
  onImageRemoved,
  maxSizeMB = 5,
  accept = "image/jpeg,image/jpg,image/png,image/webp",
  disabled = false
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 處理檔案上傳
  const handleFileUpload = useCallback(async (file: File) => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      toast.error('請先登入才能上傳圖片');
      return;
    }

    if (disabled) {
      toast.error('目前無法上傳圖片');
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // 顯示預覽
      const filePreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(filePreviewUrl);

      // 壓縮圖片（可選）
      let fileToUpload = file;
      if (file.size > 1024 * 1024) { // 大於1MB才壓縮
        console.log('壓縮圖片中...');
        setUploadProgress(20);
        fileToUpload = await compressImage(file, 1200, 0.85);
        console.log(`圖片已壓縮: ${file.size} -> ${fileToUpload.size} bytes`);
      }

      setUploadProgress(50);

      // 上傳到Firebase Storage
      const imageUrl = await uploadMistakeImage(fileToUpload, currentUser.uid);
      
      if (imageUrl) {
        setUploadProgress(100);
        onImageUploaded(imageUrl);
        
        // 清理本地預覽URL
        URL.revokeObjectURL(filePreviewUrl);
        setPreviewUrl(imageUrl);
        
        toast.success('圖片上傳成功！');
      } else {
        // 上傳失敗，清理預覽
        URL.revokeObjectURL(filePreviewUrl);
        setPreviewUrl(currentImageUrl || null);
        toast.error('圖片上傳失敗');
      }
    } catch (error) {
      console.error('圖片上傳錯誤:', error);
      toast.error('圖片上傳失敗，請重試');
      setPreviewUrl(currentImageUrl || null);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  }, [onImageUploaded, currentImageUrl, disabled]);

  // 處理拖拽事件
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    if (disabled) return;

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));
    
    if (imageFile) {
      handleFileUpload(imageFile);
    } else {
      toast.error('請選擇圖片檔案');
    }
  }, [handleFileUpload, disabled]);

  // 處理檔案選擇
  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // 清空input，允許重複選擇同一檔案
    e.target.value = '';
  }, [handleFileUpload]);

  // 移除圖片
  const handleRemoveImage = useCallback(() => {
    setPreviewUrl(null);
    if (onImageRemoved) {
      onImageRemoved();
    }
    toast.success('圖片已移除');
  }, [onImageRemoved]);

  // 點擊上傳區域
  const handleUploadClick = useCallback(() => {
    if (!disabled && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }, [disabled]);

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
        disabled={disabled}
      />

      {previewUrl ? (
        // 圖片預覽模式
        <div className="relative">
          <div className="rounded-lg overflow-hidden bg-gray-100 max-w-md mx-auto">
            <img
              src={previewUrl}
              alt="錯題圖片預覽"
              className="w-full h-auto max-h-96 object-contain"
            />
          </div>
          
          {!disabled && (
            <div className="flex justify-center mt-4 space-x-2">
              <button
                onClick={handleUploadClick}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
                disabled={isUploading}
              >
                <IoImage className="mr-2" />
                更換圖片
              </button>
              <button
                onClick={handleRemoveImage}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                disabled={isUploading}
              >
                <IoClose className="mr-2" />
                移除圖片
              </button>
            </div>
          )}
          
          {isUploading && (
            <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center rounded-lg">
              <div className="bg-white p-4 rounded-lg">
                <div className="flex items-center">
                  <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
                  <span>上傳中... {uploadProgress}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        // 上傳區域
        <div
          className={`
            border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
            ${isDragOver 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          `}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={handleUploadClick}
        >
          {isUploading ? (
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-gray-600">上傳中... {uploadProgress}%</p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <IoCloudUpload className="text-4xl text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-700 mb-2">
                點擊上傳圖片或拖拽至此
              </p>
              <p className="text-sm text-gray-500">
                支援 JPG、PNG、WebP 格式，最大 {maxSizeMB}MB
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ImageUpload; 