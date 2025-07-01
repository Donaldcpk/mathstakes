import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mistake, EducationLevel, Subject } from '../types';
import { getMistakes, initializeSampleData, clearMistakesCache, getMistakesCount, deleteMistake } from '../utils/storage';
import { formatDate } from '../utils/helpers';
import ConfettiExplosion from 'react-confetti-explosion';
import CSVImportExport from '../components/CSVImportExport';
import { IoAdd, IoSearch, IoFunnel, IoCloudDownload, IoHome, IoTrash, IoCheckbox, IoSquareOutline, IoExitOutline, IoListOutline } from 'react-icons/io5';
import { FaRegSadTear } from 'react-icons/fa';
import { Button, Container, Row, Col, Card, Form, Spinner } from 'react-bootstrap';
import { MdAdd } from 'react-icons/md';
import { FaFileImport } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { getFocusableElements } from '../utils/accessibility';
import { batchDeleteMistakes } from '../utils/deleteBatch';

const MistakeList: React.FC = () => {
  const navigate = useNavigate();
  const [mistakes, setMistakes] = useState<Mistake[]>([]);
  const [filteredMistakes, setFilteredMistakes] = useState<Mistake[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingError, setLoadingError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedGrade, setSelectedGrade] = useState<string>('all');
  const [selectedSubject, setSelectedSubject] = useState<string>('all');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [isExploding, setIsExploding] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [allMistakesCount, setAllMistakesCount] = useState(0);
  const [csvImportLoading, setCsvImportLoading] = useState(false);
  
  // 批量選擇相關狀態
  const [selectedMistakes, setSelectedMistakes] = useState<Set<string>>(new Set());
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // 篩選錯題
  useEffect(() => {
    let filtered = [...mistakes];

    // 根據教育階段篩選
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(mistake => mistake.educationLevel === selectedLevel);
    }

    // 根據年級篩選（此處需要根據您系統中的年級數據進行調整）
    if (selectedGrade !== 'all') {
      // 這裡假設錯題中有包含年級信息的字段
      // 如果沒有直接的年級字段，可能需要從其他字段或描述中提取
      filtered = filtered.filter(mistake => {
        // 示例：可以從 description 或其他字段中檢索年級信息
        const description = mistake.explanation || '';
        return description.includes(selectedGrade);
      });
    }

    // 根據科目篩選
    if (selectedSubject !== 'all') {
      filtered = filtered.filter(mistake => mistake.subject === selectedSubject);
    }

    // 根據搜尋詞篩選
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        mistake =>
          mistake.title.toLowerCase().includes(term) ||
          mistake.content.toLowerCase().includes(term) ||
          mistake.explanation?.toLowerCase().includes(term) ||
          mistake.errorType.toLowerCase().includes(term)
      );
    }

    setFilteredMistakes(filtered);
    
    // 當過濾條件變更時，清除已選擇的錯題
    if (isBatchMode) {
      setSelectedMistakes(new Set());
    }
  }, [mistakes, searchTerm, selectedLevel, selectedGrade, selectedSubject, isBatchMode]);

  // 獲取所有可用的科目
  const subjectOptions = useMemo(() => {
    const allSubjects = new Set(mistakes.map(mistake => mistake.subject));
    return Array.from(allSubjects);
  }, [mistakes]);

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

  const goToHomePage = () => {
    navigate('/');
  };

  // 處理批次刪除函數
  const handleBatchDelete = async () => {
    if (selectedMistakes.size === 0) {
      toast.error('請先選擇要刪除的錯題');
      return;
    }

    if (window.confirm(`確定要刪除所選的 ${selectedMistakes.size} 個錯題嗎？此操作無法恢復。`)) {
      setIsDeleting(true);
      try {
        const result = await batchDeleteMistakes(Array.from(selectedMistakes));
        
        // 根據結果更新UI
        if (result.success) {
          // 無論成功與否，都重新獲取錯題列表以確保UI與數據同步
          await fetchMistakes();
          
          // 清空選中狀態並退出批次模式
          setSelectedMistakes(new Set());
          setIsBatchMode(false);
        }
      } catch (error) {
        console.error('批次刪除錯題時發生錯誤:', error);
        toast.error('刪除操作失敗，請重試');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  // 切換錯題選中狀態
  const toggleMistakeSelection = (id: string) => {
    const newSelection = new Set(selectedMistakes);
    if (newSelection.has(id)) {
      newSelection.delete(id);
    } else {
      newSelection.add(id);
    }
    setSelectedMistakes(newSelection);
  };

  // 全選/取消全選
  const toggleSelectAll = () => {
    if (selectedMistakes.size === filteredMistakes.length) {
      // 如果已全選，則取消全選
      setSelectedMistakes(new Set());
    } else {
      // 否則全選
      const allIds = filteredMistakes.map(mistake => mistake.id);
      setSelectedMistakes(new Set(allIds));
    }
  };

  // 進入/退出批次模式
  const toggleBatchMode = () => {
    setIsBatchMode(!isBatchMode);
    if (isBatchMode) {
      // 退出批次模式時清空選擇
      setSelectedMistakes(new Set());
    }
  };

  const renderEmptyState = () => {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="w-20 h-20 text-blue-300 mb-4">📚</div>
        <h3 className="text-xl font-medium text-gray-700 mb-2">歡迎使用錯題收集系統</h3>
        <p className="text-gray-500 max-w-md mb-6">
          開始收集您的錯題，讓學習更有效率！您可以新增錯題或從CSV檔案匯入。
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

  // 渲染表頭
  const renderTableHeader = () => {
    return (
      <thead className="bg-gray-100 text-gray-700">
        <tr>
          {isBatchMode && (
            <th className="px-3 py-3 text-center" style={{ width: '60px' }}>
              <input
                type="checkbox"
                checked={selectedMistakes.size === filteredMistakes.length && filteredMistakes.length > 0}
                onChange={toggleSelectAll}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                aria-label="全選/取消全選"
              />
            </th>
          )}
          <th className="px-4 py-3 text-left font-medium">標題</th>
          <th className="px-4 py-3 text-left font-medium">科目</th>
          <th className="px-4 py-3 text-left font-medium">錯誤類型</th>
          <th className="px-4 py-3 text-left font-medium">日期</th>
          <th className="px-4 py-3 text-left font-medium">操作</th>
        </tr>
      </thead>
    );
  };

  // 渲染表格內容
  const renderMistakesList = () => {
    return filteredMistakes.map((mistake, index) => {
      const formattedDate = formatDate(mistake.createdAt);

      return (
        <tr
          key={mistake.id}
          className={`${selectedMistakes.has(mistake.id) ? "selected-row" : ""} ${index % 2 === 0 ? 'bg-gray-50' : 'bg-white'} hover:bg-blue-50 transition-colors`}
          onClick={isBatchMode ? () => toggleMistakeSelection(mistake.id) : undefined}
        >
          {isBatchMode && (
            <td className="px-3 py-2 text-center">
              <input
                type="checkbox"
                checked={selectedMistakes.has(mistake.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleMistakeSelection(mistake.id);
                }}
                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                aria-label={`選擇錯題: ${mistake.title}`}
              />
            </td>
          )}
          <td className="px-4 py-3">
            <div className="flex items-center space-x-3">
              {mistake.imageUrl && (
                <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden bg-gray-100">
                  <img 
                    src={mistake.imageUrl} 
                    alt="錯題縮略圖" 
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // 圖片載入失敗時隱藏
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                </div>
              )}
              <div className="flex-1">
                <div className="font-medium">
                  {isBatchMode ? (
                    mistake.title
                  ) : (
                    <Link to={`/mistake/${mistake.id}`} className="text-blue-600 hover:text-blue-800 hover:underline transition-colors">
                      {mistake.title}
                    </Link>
                  )}
                </div>
                {mistake.imageUrl && (
                  <div className="text-xs text-gray-500 mt-1">
                    📷 包含圖片
                  </div>
                )}
              </div>
            </div>
          </td>
          <td className="px-4 py-3">{mistake.subject}</td>
          <td className="px-4 py-3">
            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
              {mistake.errorType}
            </span>
          </td>
          <td className="px-4 py-3 text-gray-600 text-sm">{formattedDate}</td>
          <td className="px-4 py-3">
            {!isBatchMode && (
              <div className="flex gap-2">
                <Link to={`/mistake/${mistake.id}/edit`} className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm transition-colors">
                  編輯
                </Link>
              </div>
            )}
          </td>
        </tr>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {renderLoadingState()}
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
        <div className="flex items-center">
          <button
            onClick={goToHomePage}
            className="mr-4 p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors"
            title="返回首頁"
          >
            <IoHome className="text-gray-600" size={20} />
          </button>
          <h1 className="text-2xl font-bold text-gray-800">我的錯題集</h1>
        </div>
        
        <div className="flex space-x-2">
          <button
            className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
              isBatchMode ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            onClick={toggleBatchMode}
            disabled={isLoading}
          >
            {isBatchMode ? (
              <>
                <IoExitOutline className="mr-1" /> 退出批次模式
              </>
            ) : (
              <>
                <IoListOutline className="mr-1" /> 批次操作
              </>
            )}
          </button>
          
          {isBatchMode && (
            <button 
              className={`px-4 py-2 rounded-lg flex items-center transition-colors ${
                selectedMistakes.size === 0 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-red-600 text-white hover:bg-red-700'
              }`}
              onClick={handleBatchDelete}
              disabled={isDeleting || selectedMistakes.size === 0}
            >
              {isDeleting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  刪除中...
                </>
              ) : (
                <>
                  <IoTrash className="mr-1" /> 刪除所選
                  {selectedMistakes.size > 0 && (
                    <span className="ml-1 bg-white text-red-600 text-xs px-2 py-0.5 rounded-full font-medium">
                      {selectedMistakes.size}
                    </span>
                  )}
                </>
              )}
            </button>
          )}
          
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
            <FaFileImport className="mr-1" /> 匯入/匯出
          </button>
        </div>
      </div>
      
      {loadingError ? (
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
                {selectedSubject !== 'all' && (
                  <span className="ml-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full">
                    {selectedSubject}
                  </span>
                )}
              </button>
            </div>
            
            {showFilters && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium mb-2">按科目過濾</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setSelectedSubject('all')}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedSubject === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    全部科目
                  </button>
                  {subjectOptions.map((subject) => (
                    <button
                      key={subject}
                      onClick={() => setSelectedSubject(subject)}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedSubject === subject
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {subject}
                    </button>
                  ))}
                </div>
                
                <h3 className="font-medium mb-2 mt-4">按教育階段過濾</h3>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => {
                      setSelectedLevel('all');
                      setSelectedGrade('all');
                    }}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedLevel === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLevel(EducationLevel.JUNIOR); 
                      setSelectedGrade('all');
                    }}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedLevel === EducationLevel.JUNIOR && selectedGrade === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    初中（全部）
                  </button>
                  <button
                    onClick={() => {
                      setSelectedLevel(EducationLevel.SENIOR);
                      setSelectedGrade('all');
                    }}
                    className={`px-3 py-1 rounded-full text-sm ${
                      selectedLevel === EducationLevel.SENIOR && selectedGrade === 'all'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-800'
                    }`}
                  >
                    高中（全部）
                  </button>
                </div>
                
                {selectedLevel === EducationLevel.JUNIOR && (
                  <div>
                    <h3 className="font-medium mb-2 mt-3">初中年級</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedGrade('中一')}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedGrade === '中一'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        中一
                      </button>
                      <button
                        onClick={() => setSelectedGrade('中二')}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedGrade === '中二'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        中二
                      </button>
                      <button
                        onClick={() => setSelectedGrade('中三')}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedGrade === '中三'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        中三
                      </button>
                    </div>
                  </div>
                )}

                {selectedLevel === EducationLevel.SENIOR && (
                  <div>
                    <h3 className="font-medium mb-2 mt-3">高中年級</h3>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedGrade('中四')}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedGrade === '中四'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        中四
                      </button>
                      <button
                        onClick={() => setSelectedGrade('中五')}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedGrade === '中五'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        中五
                      </button>
                      <button
                        onClick={() => setSelectedGrade('中六')}
                        className={`px-3 py-1 rounded-full text-sm ${
                          selectedGrade === '中六'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-800'
                        }`}
                      >
                        中六
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 mb-4">
            顯示 {filteredMistakes.length} / {allMistakesCount} 個錯題
            {selectedLevel !== 'all' && ` (教育階段: ${selectedLevel})`}
            {selectedGrade !== 'all' && ` (年級: ${selectedGrade})`}
            {selectedSubject !== 'all' && ` (科目: ${selectedSubject})`}
            {searchTerm && ` (包含: "${searchTerm}")`}
            {isBatchMode && selectedMistakes.size > 0 && ` (已選擇: ${selectedMistakes.size})`}
          </p>
                  
          {isBatchMode && (
            <div className="batch-mode-hint">
              <p>批次模式: 點擊錯題可選中，再次點擊取消選中。選中後可進行批次刪除操作。</p>
                    </div>
                  )}
                  
          <div className="mistake-table-container">
            <table className="mistake-table">
              {renderTableHeader()}
              <tbody>{renderMistakesList()}</tbody>
            </table>
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
    </div>
  );
};

export default MistakeList; 