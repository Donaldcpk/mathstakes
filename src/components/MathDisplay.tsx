import React, { useState } from 'react';
import 'katex/dist/katex.min.css';
import { InlineMath, BlockMath } from 'react-katex';

interface MathDisplayProps {
  content: string;
}

/**
 * 將文本中的LaTeX數學公式渲染為正確的數學形式
 * 能夠識別文本中的行內公式 (使用 $ 或 \( \) 包裹) 和塊級公式 (使用 $$ 或 \[ \] 包裹)
 */
const MathDisplay: React.FC<MathDisplayProps> = ({ content }) => {
  const [error, setError] = useState<string | null>(null);

  // 辨識並渲染LaTeX公式
  const renderMathContent = () => {
    if (!content) return null;

    // 正則表達式用於匹配LaTeX公式
    const inlineMathRegex1 = /\$([^$]+)\$/g; // $...$
    const inlineMathRegex2 = /\\\\begin\{align\}([^]+?)\\\\end\{align\}/g; // \begin{align}...\end{align}
    const inlineMathRegex3 = /\\\((.*?)\\\)/g; // \(...\)
    const blockMathRegex1 = /\$\$([^$]+)\$\$/g; // $$...$$
    const blockMathRegex2 = /\\\[(.*?)\\\]/g; // \[...\]

    // 將內容拆分為普通文本和公式
    let lastIndex = 0;
    const segments: JSX.Element[] = [];
    let match: RegExpExecArray | null;
    let tempContent = content;
    let id = 0;

    // 處理行內公式 $...$
    while ((match = inlineMathRegex1.exec(tempContent)) !== null) {
      // 添加公式前的普通文本
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${id++}`}>{tempContent.substring(lastIndex, match.index)}</span>
        );
      }

      // 添加公式，使用 try-catch 處理渲染錯誤
      try {
        segments.push(
          <InlineMath key={`math-${id++}`} math={match[1]} />
        );
      } catch (e) {
        segments.push(
          <span key={`math-error-${id++}`} className="text-red-500">
            {match[0]} (公式渲染錯誤)
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // 處理行內公式 \(...\)
    tempContent = content;
    lastIndex = 0;
    while ((match = inlineMathRegex3.exec(tempContent)) !== null) {
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${id++}`}>{tempContent.substring(lastIndex, match.index)}</span>
        );
      }

      try {
        segments.push(
          <InlineMath key={`math-${id++}`} math={match[1]} />
        );
      } catch (e) {
        segments.push(
          <span key={`math-error-${id++}`} className="text-red-500">
            {match[0]} (公式渲染錯誤)
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // 處理行內公式 \begin{align}...\end{align}
    tempContent = content;
    lastIndex = 0;
    while ((match = inlineMathRegex2.exec(tempContent)) !== null) {
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${id++}`}>{tempContent.substring(lastIndex, match.index)}</span>
        );
      }

      try {
        segments.push(
          <InlineMath key={`math-${id++}`} math={match[1]} />
        );
      } catch (e) {
        segments.push(
          <span key={`math-error-${id++}`} className="text-red-500">
            {match[0]} (公式渲染錯誤)
          </span>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // 處理塊級公式 $$...$$
    tempContent = content;
    lastIndex = 0;
    while ((match = blockMathRegex1.exec(tempContent)) !== null) {
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${id++}`}>{tempContent.substring(lastIndex, match.index)}</span>
        );
      }

      try {
        segments.push(
          <BlockMath key={`math-${id++}`} math={match[1]} />
        );
      } catch (e) {
        segments.push(
          <div key={`math-error-${id++}`} className="text-red-500 py-2">
            {match[0]} (公式渲染錯誤)
          </div>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // 處理塊級公式 \[...\]
    tempContent = content;
    lastIndex = 0;
    while ((match = blockMathRegex2.exec(tempContent)) !== null) {
      if (match.index > lastIndex) {
        segments.push(
          <span key={`text-${id++}`}>{tempContent.substring(lastIndex, match.index)}</span>
        );
      }

      try {
        segments.push(
          <BlockMath key={`math-${id++}`} math={match[1]} />
        );
      } catch (e) {
        segments.push(
          <div key={`math-error-${id++}`} className="text-red-500 py-2">
            {match[0]} (公式渲染錯誤)
          </div>
        );
      }

      lastIndex = match.index + match[0].length;
    }

    // 添加最後一部分文本
    if (lastIndex < tempContent.length) {
      segments.push(
        <span key={`text-${id++}`}>{tempContent.substring(lastIndex)}</span>
      );
    }

    // 如果沒有識別到任何公式，則直接顯示原始內容
    if (segments.length === 0) {
      return <span>{content}</span>;
    }

    return segments;
  };

  return (
    <div className="math-display">
      {error ? (
        <div className="text-red-500">{error}</div>
      ) : (
        renderMathContent()
      )}
    </div>
  );
};

export default MathDisplay; 