import React, { useEffect, useState } from 'react';
import 'katex/dist/katex.min.css';
import katex from 'katex';

interface MathDisplayProps {
  content: string;
  className?: string;
}

/**
 * 將文本中的數學公式轉換為KaTeX渲染的HTML
 * 支持以下格式的公式:
 * 1. 美元符號包圍的內聯公式: $formula$
 * 2. 雙美元符號包圍的塊級公式: $$formula$$
 */
const MathDisplay: React.FC<MathDisplayProps> = ({ content, className = '' }) => {
  const [processedContent, setProcessedContent] = useState<string>('');

  useEffect(() => {
    if (!content) {
      setProcessedContent('');
      return;
    }

    try {
      // 找出文本中的所有數學公式（使用正則表達式）
      // 匹配 $...$ 作為內聯公式
      // 匹配 $$...$$ 作為塊級公式
      
      // 替換塊級公式（$$...$$）
      let result = content.replace(/\$\$(.*?)\$\$/g, (match, formula) => {
        try {
          const html = katex.renderToString(formula.trim(), {
            displayMode: true,
            throwOnError: false
          });
          return `<div class="math-block">${html}</div>`;
        } catch (err) {
          console.error('KaTeX渲染塊級公式出錯:', err);
          return match; // 如果渲染失敗，保留原樣
        }
      });
      
      // 替換內聯公式（$...$）
      result = result.replace(/\$([^\$]+?)\$/g, (match, formula) => {
        try {
          const html = katex.renderToString(formula.trim(), {
            displayMode: false,
            throwOnError: false
          });
          return `<span class="math-inline">${html}</span>`;
        } catch (err) {
          console.error('KaTeX渲染內聯公式出錯:', err);
          return match; // 如果渲染失敗，保留原樣
        }
      });
      
      setProcessedContent(result);
    } catch (error) {
      console.error('處理數學公式時出錯:', error);
      setProcessedContent(content); // 出錯時顯示原始內容
    }
  }, [content]);

  return (
    <div 
      className={`math-display ${className}`}
      dangerouslySetInnerHTML={{ __html: processedContent }}
    />
  );
};

export default MathDisplay; 