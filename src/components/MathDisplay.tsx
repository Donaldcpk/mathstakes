import React from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathDisplayProps {
  content: string;
  isBlock?: boolean;
}

/**
 * 將文本中的 LaTeX 表達式識別並渲染為數學公式
 * LaTeX 表達式格式：
 * 行內公式：$...$
 * 區塊公式：$$...$$
 */
const MathDisplay: React.FC<MathDisplayProps> = ({ content, isBlock = false }) => {
  if (!content) return null;

  try {
    // 檢查是否整個內容就是一個 LaTeX 公式
    if (isBlock) {
      return <BlockMath math={content} />;
    }

    // 處理混合內容（文本 + 行內公式）
    // 正則表達式匹配 $...$ 格式的行內公式
    const parts = content.split(/(\$[^$]+\$)/g);
    
    return (
      <>
        {parts.map((part, index) => {
          // 檢查是否是 LaTeX 公式 ($...$)
          if (part.startsWith('$') && part.endsWith('$') && part.length > 2) {
            try {
              // 移除 $ 符號並渲染公式
              const formula = part.slice(1, -1);
              return <InlineMath key={index} math={formula} />;
            } catch (error) {
              console.error('LaTeX 渲染錯誤:', error);
              return <span key={index} className="text-red-500">{part}</span>;
            }
          }
          
          // 檢查是否包含 $$...$$ 格式的區塊公式
          if (part.includes('$$')) {
            const blockParts = part.split(/(\$\$[^$]+\$\$)/g);
            return (
              <React.Fragment key={index}>
                {blockParts.map((blockPart, blockIndex) => {
                  if (blockPart.startsWith('$$') && blockPart.endsWith('$$') && blockPart.length > 4) {
                    try {
                      // 移除 $$ 符號並渲染區塊公式
                      const formula = blockPart.slice(2, -2);
                      return <BlockMath key={`${index}-${blockIndex}`} math={formula} />;
                    } catch (error) {
                      console.error('LaTeX 區塊渲染錯誤:', error);
                      return <span key={`${index}-${blockIndex}`} className="text-red-500">{blockPart}</span>;
                    }
                  }
                  // 純文本
                  return blockPart ? <span key={`${index}-${blockIndex}`}>{blockPart}</span> : null;
                })}
              </React.Fragment>
            );
          }
          
          // 純文本
          return part ? <span key={index}>{part}</span> : null;
        })}
      </>
    );
  } catch (error) {
    console.error('MathDisplay 渲染錯誤:', error);
    return <span className="text-red-500">無法渲染內容: {content}</span>;
  }
};

export default MathDisplay; 