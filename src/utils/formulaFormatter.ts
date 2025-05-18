/**
 * 數學公式格式化工具
 * 用於將文本中的LaTeX格式數學公式轉換為可顯示的格式
 */
import katex from 'katex';
import 'katex/dist/katex.min.css';
import OpenCC from 'opencc-js';

// 初始化OpenCC簡繁轉換器
const converter = OpenCC.Converter({ from: 'cn', to: 'tw' });

/**
 * 檢查文本是否包含LaTeX數學公式
 * @param text 要檢查的文本
 * @returns 是否包含數學公式
 */
export const containsLatexFormula = (text: string): boolean => {
  if (!text) return false;
  
  // 檢查常見的LaTeX數學公式符號
  const latexPatterns = [
    /\$[^$]+\$/,          // 行內公式 $formula$
    /\$\$[^$]+\$\$/,      // 區塊公式 $$formula$$
    /\\begin{equation}/,  // 方程式環境
    /\\begin{align}/,     // 對齊環境
    /\\frac{.*?}{.*?}/,   // 分數
    /\\sqrt{.*?}/,        // 平方根
    /\\sum_/,             // 求和符號
    /\\int_/,             // 積分符號
    /\\prod_/,            // 乘積符號
    /\\lim_/              // 極限符號
  ];
  
  return latexPatterns.some(pattern => pattern.test(text));
};

/**
 * 為使用MathJax的組件準備數學公式相關頭部資源
 * @returns 包含MathJax配置的HTML字符串
 */
export const getMathJaxConfig = (): string => {
  return `
    <script>
      window.MathJax = {
        tex: {
          inlineMath: [['$', '$'], ['\\\\(', '\\\\)']],
          displayMath: [['$$', '$$'], ['\\\\[', '\\\\]']],
          processEscapes: true,
          processEnvironments: true
        },
        svg: {
          fontCache: 'global'
        },
        options: {
          enableMenu: false
        }
      };
    </script>
    <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  `;
};

/**
 * 使用KaTeX將數學公式渲染為HTML
 * @param formula LaTeX數學公式
 * @param displayMode 是否為塊級顯示模式
 * @returns 渲染後的HTML字符串
 */
export const renderFormulaWithKaTeX = (formula: string, displayMode: boolean = false): string => {
  try {
    return katex.renderToString(formula, {
      displayMode,
      throwOnError: false,
      errorColor: '#f44336',
      macros: {
        '\\implies': '\\Rightarrow',
        '\\iff': '\\Leftrightarrow'
      },
      fleqn: false
    });
  } catch (error) {
    console.error('KaTeX渲染錯誤:', error);
    return `<span style="color: #f44336;">[數學公式渲染錯誤: ${formula}]</span>`;
  }
};

/**
 * 將中文數學表達轉換為LaTeX格式
 * 例如：將「m = 35°」轉換為「$m = 35^\\circ$」
 * @param text 原始文本
 * @returns 轉換後的文本
 */
export const convertChineseMathToLatex = (text: string): string => {
  if (!text) return '';
  
  // 轉換常見的數學表達式為LaTeX
  let result = text;
  
  // 轉換角度符號 (如 35°)
  result = result.replace(/(\d+)°/g, '$1^\\circ');
  
  // 轉換分數表達式 (如 1/2)
  result = result.replace(/(\d+)\/(\d+)/g, '\\frac{$1}{$2}');
  
  // 轉換平方表達式 (如 x²)
  result = result.replace(/([a-zA-Z\d])²/g, '$1^2');
  result = result.replace(/([a-zA-Z\d])³/g, '$1^3');
  
  // 處理常見的數學運算符號
  const symbolMap: Record<string, string> = {
    '≠': '\\neq',
    '≤': '\\leq',
    '≥': '\\geq',
    '±': '\\pm',
    '∓': '\\mp',
    '×': '\\times',
    '÷': '\\div',
    '∞': '\\infty',
    '∑': '\\sum',
    '∏': '\\prod',
    '∫': '\\int',
    '√': '\\sqrt',
    '∂': '\\partial',
    '∇': '\\nabla',
    '∀': '\\forall',
    '∃': '\\exists',
    '∈': '\\in',
    '∉': '\\notin',
    '⊂': '\\subset',
    '⊆': '\\subseteq',
    '⊃': '\\supset',
    '⊇': '\\supseteq',
    '∩': '\\cap',
    '∪': '\\cup',
    '¬': '\\neg',
    '∧': '\\wedge',
    '∨': '\\vee',
    '⇒': '\\Rightarrow',
    '⇔': '\\Leftrightarrow',
    'π': '\\pi',
    'θ': '\\theta',
    'φ': '\\phi',
    'α': '\\alpha',
    'β': '\\beta',
    'γ': '\\gamma',
    'δ': '\\delta',
    'ε': '\\epsilon',
    'λ': '\\lambda',
    'μ': '\\mu',
    'σ': '\\sigma',
    'τ': '\\tau',
    'ω': '\\omega',
    'Δ': '\\Delta',
    'Σ': '\\Sigma',
    'Π': '\\Pi',
    'Ω': '\\Omega'
  };
  
  // 應用符號映射
  for (const [symbol, latex] of Object.entries(symbolMap)) {
    result = result.replace(new RegExp(symbol, 'g'), latex);
  }
  
  return result;
};

/**
 * 準備文本中的數學公式以便在使用MathJax的環境中顯示
 * @param text 包含可能的數學公式的文本
 * @returns 處理後的文本，可以透過MathJax正確渲染
 */
export const prepareFormulasForDisplay = (text: string): string => {
  if (!text) return '';
  
  // 將文本分割成數學公式和非數學公式部分
  // 這裡使用簡單的方法處理 $...$ 和 $$...$$ 形式的公式
  let result = '';
  let inMath = false;
  let inBlockMath = false;
  let buffer = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1] || '';
    
    if (char === '$' && nextChar === '$' && !inMath && !inBlockMath) {
      // 開始區塊公式
      if (buffer) {
        result += convertChineseMathToLatex(buffer);
        buffer = '';
      }
      result += '$$';
      inBlockMath = true;
      i++; // 跳過下一個 $
    } else if (char === '$' && nextChar === '$' && inBlockMath) {
      // 結束區塊公式
      result += '$$';
      inBlockMath = false;
      i++; // 跳過下一個 $
    } else if (char === '$' && !inMath && !inBlockMath) {
      // 開始行內公式
      if (buffer) {
        result += convertChineseMathToLatex(buffer);
        buffer = '';
      }
      result += '$';
      inMath = true;
    } else if (char === '$' && inMath) {
      // 結束行內公式
      result += '$';
      inMath = false;
    } else if (inMath || inBlockMath) {
      // 在公式內部，保持原樣
      result += char;
    } else {
      // 在公式外部，累積到緩衝區
      buffer += char;
    }
  }
  
  // 處理剩餘部分
  if (buffer) {
    result += convertChineseMathToLatex(buffer);
  }
  
  return result;
};

/**
 * 使用OpenCC將簡體中文轉換為繁體中文
 * @param text 簡體中文文本
 * @returns 繁體中文文本
 */
export const convertToTraditionalChinese = (text: string): string => {
  if (!text) return '';
  return converter(text);
};

/**
 * 處理AI回答，包括簡繁轉換和數學公式格式化
 * @param text AI回答的原始文本
 * @returns 處理後的文本，轉換為繁體中文並格式化數學公式
 */
export const processAIResponse = (text: string): string => {
  if (!text) return '';
  
  // 先進行簡繁轉換
  const traditionalText = convertToTraditionalChinese(text);
  
  // 再處理數學公式
  return prepareFormulasForDisplay(traditionalText);
};

/**
 * 將包含LaTeX公式的文本渲染為HTML
 * 可用於在React組件中渲染數學公式
 * @param text 包含LaTeX公式的文本
 * @returns 渲染後的HTML，可在React中使用dangerouslySetInnerHTML
 */
export const renderMathContent = (text: string): string => {
  if (!text) return '';
  
  // 先處理文本中的數學公式
  const preparedText = prepareFormulasForDisplay(text);
  
  // 使用正則表達式分割文本和公式
  const parts: string[] = [];
  let lastIndex = 0;
  
  // 處理塊級公式 $$...$$
  const blockRegex = /\$\$([\s\S]+?)\$\$/g;
  let match;
  
  while ((match = blockRegex.exec(preparedText)) !== null) {
    // 添加公式前的文本
    if (match.index > lastIndex) {
      parts.push(preparedText.substring(lastIndex, match.index));
    }
    
    // 渲染數學公式
    try {
      parts.push(renderFormulaWithKaTeX(match[1], true));
    } catch (e) {
      parts.push(`<div class="math-error">公式渲染錯誤: ${match[0]}</div>`);
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩餘的文本
  if (lastIndex < preparedText.length) {
    const remainingText = preparedText.substring(lastIndex);
    
    // 處理行內公式 $...$
    const inlineRegex = /\$((?:[^$]|\\\$)+?)\$/g;
    let inlineText = '';
    let inlineLastIndex = 0;
    let inlineMatch;
    
    while ((inlineMatch = inlineRegex.exec(remainingText)) !== null) {
      // 添加公式前的文本
      if (inlineMatch.index > inlineLastIndex) {
        inlineText += remainingText.substring(inlineLastIndex, inlineMatch.index);
      }
      
      // 渲染行內數學公式
      try {
        inlineText += renderFormulaWithKaTeX(inlineMatch[1], false);
      } catch (e) {
        inlineText += `<span class="math-error">公式渲染錯誤: ${inlineMatch[0]}</span>`;
      }
      
      inlineLastIndex = inlineMatch.index + inlineMatch[0].length;
    }
    
    // 添加剩餘的文本
    if (inlineLastIndex < remainingText.length) {
      inlineText += remainingText.substring(inlineLastIndex);
    }
    
    parts.push(inlineText);
  }
  
  return parts.join('');
};

export default {
  containsLatexFormula,
  getMathJaxConfig,
  convertChineseMathToLatex,
  prepareFormulasForDisplay,
  convertToTraditionalChinese,
  processAIResponse,
  renderMathContent,
  renderFormulaWithKaTeX
}; 