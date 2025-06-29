import React from 'react';
import MathDisplay from './MathDisplay';

interface AIExplanationProps {
  explanation: string;
}

/**
 * AI解釋顯示組件
 * 使用MathDisplay渲染數學公式
 */
const AIExplanation: React.FC<AIExplanationProps> = ({ explanation }) => {
  if (!explanation) {
    return (
      <div className="ai-explanation-placeholder">
        <p>還沒有AI解釋，請生成解釋後查看。</p>
      </div>
    );
  }

  // 將解釋按段落分割
  const sections = explanation.split(/\n\n+/).filter(section => section.trim().length > 0);

  return (
    <div className="ai-explanation">
      {sections.map((section, index) => {
        // 檢查是否是標題行（假設標題以「#」開頭或者是全大寫或者末尾有冒號）
        const isHeader = /^(#+\s|[A-Z\s\d:]+:$)/.test(section.trim());
        
        if (isHeader) {
          return (
            <h3 key={index} className="explanation-section-title text-lg font-bold mt-4 mb-2 text-blue-700">
              {section}
            </h3>
          );
        }
        
        return (
          <div key={index} className="explanation-section mb-4">
            <MathDisplay 
              content={section} 
              className="whitespace-pre-wrap text-gray-800"
            />
          </div>
        );
      })}
    </div>
  );
};

export default AIExplanation; 