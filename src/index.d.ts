interface Window {
  MathJax?: {
    typeset?: (elements: Array<Element>) => void;
    startup?: {
      promise: Promise<any>;
    };
    tex?: any;
    svg?: any;
    options?: any;
  };
} 