import React, { useEffect, useRef } from 'react';
import { renderMathContent } from '../utils/formulaFormatter';

interface MathDisplayProps {
  math: string;
  className?: string;
}

/**
 * 數學公式顯示組件
 * 能夠渲染包含LaTeX數學公式的文本
 */
const MathDisplay: React.FC<MathDisplayProps> = ({ math, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  // 使用KaTeX渲染數學公式
  useEffect(() => {
    if (!math || !containerRef.current) return;
    
    // 使用MathJax渲染 (如果可用)
    if (window.MathJax && window.MathJax.typeset) {
      window.MathJax.typeset([containerRef.current]);
    }
  }, [math]);
  
  if (!math) return null;
  
  // 使用formulaFormatter處理數學公式
  const renderedContent = renderMathContent(math);
  
  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: renderedContent }} 
    />
  );
};

export default MathDisplay; 