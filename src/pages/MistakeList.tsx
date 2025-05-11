import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mistake, EducationLevel, Subject } from '../types';
import { getMistakes, initializeSampleData, clearMistakesCache, getMistakesCount } from '../utils/storage';
import { exportToExcel } from '../utils/excel';
import { formatDate } from '../utils/helpers';
import ConfettiExplosion from 'react-confetti-explosion';
import CSVImportExport from '../components/CSVImportExport';
import { IoAdd, IoSearch, IoFunnel, IoCloudDownload } from 'react-icons/io5';
import { FaRegSadTear } from 'react-icons/fa';
import { exportMistakesToExcel } from '../utils/excelExport';

const MistakeList: React.FC = () => {
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [filteredMistakes, setFilteredMistakes] = useState<Mistake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSubjects, setSelectedSubjects] = useState<Subject[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [allMistakesCount, setAllMistakesCount] = useState(0);
  const [csvImportLoading, setCsvImportLoading] = useState(false);

  // 從本地儲存獲取資料
  const fetchMistakes = useCallback(async () => {
    setIsLoading(true);
    setLoadingError(null);
    
    try {
      console.time('fetch-mistakes');
      const data = await getMistakes();
      const count = await getMistakesCount();
      console.timeEnd('fetch-mistakes');
      
      setMistakes(data);
      setFilteredMistakes(data);
      setAllMistakesCount(count);
      
      // 提取所有科目用於過濾
      const uniqueSubjects = Array.from(new Set(data.map(m => m.subject)))
        .filter(Boolean) as Subject[];
      setSubjects(uniqueSubjects);
    } catch (error) {
      console.error('Failed to fetch mistakes:', error);
      setLoadingError('無法載入錯題列表，請稍後再試');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 初始加載
  useEffect(() => {
    fetchMistakes();
  }, [fetchMistakes]);
  
  // 監聽背景數據更新事件
  useEffect(() => {
    const handleMistakesUpdated = (event: Event) => {
      // 檢查自定義事件類型
      if (event instanceof CustomEvent && event.detail?.mistakes) {
        console.log('接收到錯題數據更新事件');
        setMistakes(event.detail.mistakes);
      }
    };
    
    // 添加事件監聽
    window.addEventListener('mistakesUpdated', handleMistakesUpdated);
    
    // 組件卸載時移除事件監聽
    return () => {
      window.removeEventListener('mistakesUpdated', handleMistakesUpdated);
    };
  }, []);

  // 使用useMemo優化篩選操作，避免不必要的重新計算
  const filteredMistakes = useMemo(() => {
    return mistakes.filter(mistake => {
      const matchesSearch = mistake.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          mistake.content.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSubject = selectedSubjects.length === 0 || selectedSubjects.includes(mistake.subject);
      const matchesLevel = mistake.educationLevel === filterLevel;
      return matchesSearch && matchesSubject && matchesLevel;
    });
  }, [mistakes, searchTerm, selectedSubjects, filterLevel]);

  const handleCSVImportSuccess = () => {
    setCsvImportLoading(false);
    setImportSuccess(true);
    setShowCSVModal(false);
    setIsExploding(true);
    setTimeout(() => {
      setImportSuccess(false);
      fetchMistakes();
    }, 3000);
  };

  const handleCSVImportStart = () => {
    setCsvImportLoading(true);
  };

  const renderEmptyState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <FaRegSadTear className="w-20 h-20 text-gray-300 mb-4" />
        <h3 className="text-xl font-medium text-gray-700 mb-2">目前還沒有收集到錯題</h3>
        <p className="text-gray-500 max-w-md mb-6">
          開始收集你的錯題，讓學習更有效率。您可以新增錯題或從CSV檔案匯入。
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <button
            onClick={() => navigate('/add-mistake')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg flex items-center shadow-md hover:bg-blue-700 transition-colors"
          >
            <IoAdd className="mr-2" /> 新增錯題
          </button>
          <button
            onClick={() => setShowCSVModal(true)}
            className="px-6 py-3 bg-green-600 text-white rounded-lg flex items-center shadow-md hover:bg-green-700 transition-colors"
          >
            <IoCloudDownload className="mr-2" /> 匯入CSV
          </button>
        </div>
      </div>
    );
  };

  const renderLoadingState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-600">正在載入錯題列表...</p>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {isExploding && <ConfettiExplosion duration={3000} particleCount={100} />}
        
        {importSuccess && (
          <div className="fixed top-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md z-50">
            <p className="font-bold">匯入成功！</p>
            <p>您的錯題已成功匯入系統。</p>
          </div>
        )}
        
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">我的錯題集</h1>
          <div className="flex space-x-2">
            <button
              onClick={() => navigate('/add-mistake')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center hover:bg-blue-700 transition-colors"
            >
              <IoAdd className="mr-1" /> 新增
            </button>
            <button
              onClick={() => setShowCSVModal(true)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors"
            >
              <IoCloudDownload className="mr-1" /> 匯入/匯出
            </button>
          </div>
        </div>
        
        {isLoading ? (
          renderLoadingState()
        ) : loadingError ? (
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
            <p>{loadingError}</p>
            <button 
              onClick={fetchMistakes}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              重試
            </button>
          </div>
        ) : mistakes.length === 0 ? (
          renderEmptyState()
        ) : (
          <>
            <div className="mb-6 bg-white rounded-lg shadow-md p-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IoSearch className="text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="搜尋錯題..."
                    className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                    showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  <IoFunnel className="mr-2" /> 過濾
                  {selectedSubjects.length > 0 && (
                    <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                      {selectedSubjects.length}
                    </span>
                  )}
                </button>
                <button
                  onClick={exportToExcel}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center hover:bg-purple-700 transition-colors"
                >
                  <IoCloudDownload className="mr-2" /> 匯出Excel
                </button>
              </div>
              
              {showFilters && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <h3 className="font-medium mb-2">按科目過濾</h3>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((subject) => (
                      <button
                        key={subject}
                        onClick={() => toggleSubjectFilter(subject)}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedSubjects.includes(subject)
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        {subject}
                      </button>
                    ))}
                    {selectedSubjects.length > 0 && (
                      <button
                        onClick={() => setSelectedSubjects([])}
                        className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                      >
                        清除過濾
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
            
            <p className="text-sm text-gray-600 mb-4">
              顯示 {filteredMistakes.length} / {allMistakesCount} 個錯題
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMistakes.map((mistake) => (
                <Link
                  key={mistake.id}
                  to={`/mistake/${mistake.id}`}
                  className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
                >
                  <div className="p-5">
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="font-medium text-lg text-gray-800 line-clamp-2">
                        {mistake.title || '未命名錯題'}
                      </h3>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {mistake.subject}
                      </span>
                    </div>
                    
                    {mistake.imageUrls?.[0] && (
                      <div className="relative h-40 mb-3 bg-gray-100 rounded overflow-hidden">
                        <img
                          src={mistake.imageUrls[0]}
                          alt="錯題圖片"
                          className="w-full h-full object-contain"
                          loading="lazy"
                        />
                      </div>
                    )}
                    
                    <div className="text-sm text-gray-600 line-clamp-3 mb-3">
                      {mistake.description || '沒有描述'}
                    </div>
                    
                    <div className="flex justify-between items-center text-xs text-gray-500 mt-auto">
                      <span>
                        {formatDate(mistake.createdAt)}
                      </span>
                      {mistake.aiExplanation && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                          AI分析完成
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
        
        {showCSVModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
              <div className="p-6">
                <h2 className="text-lg font-bold mb-4">匯入/匯出錯題</h2>
                <CSVImportExport 
                  onImportSuccess={handleCSVImportSuccess} 
                  onClose={() => setShowCSVModal(false)}
                  onImportStart={handleCSVImportStart}
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={() => setShowCSVModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                  >
                    關閉
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {csvImportLoading && (
          <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50">
            <div className="bg-white p-6 rounded-lg shadow-lg text-center">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
              <h3 className="text-lg font-semibold mb-2">匯入中...</h3>
              <p className="text-gray-600">正在處理您的CSV檔案，請稍候...</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {isExploding && <ConfettiExplosion duration={3000} particleCount={100} />}
      
      {importSuccess && (
        <div className="fixed top-4 right-4 bg-green-100 border-l-4 border-green-500 text-green-700 p-4 rounded shadow-md z-50">
          <p className="font-bold">匯入成功！</p>
          <p>您的錯題已成功匯入系統。</p>
        </div>
      )}
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">我的錯題集</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => navigate('/add-mistake')}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg flex items-center hover:bg-blue-700 transition-colors"
          >
            <IoAdd className="mr-1" /> 新增
          </button>
          <button
            onClick={() => setShowCSVModal(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg flex items-center hover:bg-green-700 transition-colors"
          >
            <IoCloudDownload className="mr-1" /> 匯入/匯出
          </button>
        </div>
      </div>
      
      {isLoading ? (
        renderLoadingState()
      ) : loadingError ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4 rounded">
          <p>{loadingError}</p>
          <button 
            onClick={fetchMistakes}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            重試
          </button>
        </div>
      ) : mistakes.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <div className="mb-6 bg-white rounded-lg shadow-md p-4">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <IoSearch className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜尋錯題..."
                  className="pl-10 w-full border border-gray-300 rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                  showFilters ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                }`}
              >
                <IoFunnel className="mr-2" /> 過濾
                {selectedSubjects.length > 0 && (
                  <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    {selectedSubjects.length}
                  </span>
                )}
              </button>
              <button
                onClick={exportToExcel}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg flex items-center hover:bg-purple-700 transition-colors"
              >
                <IoCloudDownload className="mr-2" /> 匯出Excel
              </button>
            </div>
            
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">按科目過濾</h3>
                <div className="flex flex-wrap gap-2">
                  {subjects.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => toggleSubjectFilter(subject)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedSubjects.includes(subject)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {subject}
                    </button>
                  ))}
                  {selectedSubjects.length > 0 && (
                    <button
                      onClick={() => setSelectedSubjects([])}
                      className="px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                    >
                      清除過濾
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            顯示 {filteredMistakes.length} / {allMistakesCount} 個錯題
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMistakes.map((mistake) => (
              <Link
                key={mistake.id}
                to={`/mistake/${mistake.id}`}
                className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-5">
                  <div className="flex justify-between items-start mb-3">
                    <h3 className="font-medium text-lg text-gray-800 line-clamp-2">
                      {mistake.title || '未命名錯題'}
                    </h3>
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      {mistake.subject}
                    </span>
                  </div>
                  
                  {mistake.imageUrls?.[0] && (
                    <div className="relative h-40 mb-3 bg-gray-100 rounded overflow-hidden">
                      <img
                        src={mistake.imageUrls[0]}
                        alt="錯題圖片"
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>
                  )}
                  
                  <div className="text-sm text-gray-600 line-clamp-3 mb-3">
                    {mistake.description || '沒有描述'}
                  </div>
                  
                  <div className="flex justify-between items-center text-xs text-gray-500 mt-auto">
                    <span>
                      {formatDate(mistake.createdAt)}
                    </span>
                    {mistake.aiExplanation && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                        AI分析完成
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
      
      {showCSVModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-xl overflow-hidden">
            <div className="p-6">
              <h2 className="text-lg font-bold mb-4">匯入/匯出錯題</h2>
              <CSVImportExport 
                onImportSuccess={handleCSVImportSuccess} 
                onClose={() => setShowCSVModal(false)}
                onImportStart={handleCSVImportStart}
              />
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowCSVModal(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
                >
                  關閉
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {csvImportLoading && (
        <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg text-center">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4 mx-auto"></div>
            <h3 className="text-lg font-semibold mb-2">匯入中...</h3>
            <p className="text-gray-600">正在處理您的CSV檔案，請稍候...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MistakeList; 