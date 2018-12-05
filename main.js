function StackedGraph(htmlElement) {
  if(typeof htmlElement === 'string') {
    htmlElement = document.getElementById(htmlElement);
  }
  if(!(htmlElement instanceof SVGElement)) {
    console.error('StackedGraph need passing a SVG element');
    return;
  }
  // Clear view box setting
  htmlElement.removeAttribute('viewBox');

  // Private properties
  // Baseline function
  this._baseline = () => 0;
  // Data representation
  // [ group1, group2, group3, ... ]
  // For each group:
  // [ x1, x2, x3, x4, ... ]
  this._data = [ new Array(10).fill(null).map((val, i) => Math.sin(i/20)) ];
  // HTML element
  this._htmlElement = htmlElement;
  // Padding
  this.padding = { left: 20, right: 20, top: 10, bottom: 32 };
  // Graduation spacing
  this.gradSpacing = 100;
  this.gradHeight = 8;

  // Horizontal axis tag mapping function
  this.tagMapping = index => '' + index;

  // Inserting SVG
  let svgns = 'http://www.w3.org/2000/svg';

  // Horizontal axis line
  this.horizontalAxis = document.createElementNS(svgns, 'line');
  this.horizontalAxis.resize = () => {
    this.horizontalAxis.setAttribute('x1', this.padding.left);
    this.horizontalAxis.setAttribute('x2', this._htmlElement.clientWidth - this.padding.right);
    this.horizontalAxis.setAttribute('y1', this._htmlElement.clientHeight - this.padding.bottom);
    this.horizontalAxis.setAttribute('y2', this._htmlElement.clientHeight - this.padding.bottom);
  }
  this.horizontalAxis.style.stroke = '#aaaaaa';
  this.horizontalAxis.style.strokeWidth = '1px';
  this.horizontalAxis.classList.add('stacked-h-axis');
  this._htmlElement.appendChild(this.horizontalAxis);
  // Horizontal axis graduations
  this.horizontalGrads = [];
  this.horizontalGradTags = [];
  this.horizontalGrads.resize = () => {
    this.horizontalGrads.forEach(element => this._htmlElement.removeChild(element));
    this.horizontalGradTags.forEach(element => this._htmlElement.removeChild(element));
    this.horizontalGrads.splice(0, this.horizontalGrads.length);
    this.horizontalGradTags.splice(0, this.horizontalGradTags.length);
    let [ left, right, bottom ] = [ this.padding.left, this.padding.right, this.padding.bottom ];
    let [ width, height ] = [ this._htmlElement.clientWidth, this._htmlElement.clientHeight ];
    let n = Math.ceil((width - left - right)/this.gradSpacing);
    let step = Math.ceil(this.dataDimension/n);
    if(step > 50) {
      step = Math.ceil(step/10) * 10;
    }
    for(let i = 0; i < n; i++) {
      let grad = document.createElementNS(svgns, 'line');
      let stepLength = (width - left - right) / this.dataDimension * step;
      grad.setAttribute('x1', left + i * stepLength);
      grad.setAttribute('x2', left + i * stepLength);
      grad.setAttribute('y1', height - bottom - this.gradHeight);
      grad.setAttribute('y2', height - bottom);
      grad.style.stroke = '#aaaaaa';
      grad.style.strokeWidth = '1px';
      grad.classList.add('stacked-h-grad');
      this._htmlElement.appendChild(grad);
      this.horizontalGrads.push(grad);

      let tag = document.createElementNS(svgns, 'text');
      tag.setAttribute('x', left + i * stepLength);
      tag.setAttribute('y', height - bottom - this.gradHeight + 28);
      tag.setAttribute('text-anchor', 'middle');
      tag.classList.add('stacked-h-tag');
      tag.innerHTML = this.tagMapping(i * step);
      this._htmlElement.appendChild(tag);
      this.horizontalGrads.push(tag);
    }
  }

  publicStackedGraph(this);
  bindingResizeFunctions(this);
}

function bindingResizeFunctions(stackGraph) {
  ['horizontalAxis', 'horizontalGrads'].map(prop => {
    window.addEventListener('resize', stackGraph[prop].resize);
    stackGraph[prop].resize();
  })
}

function publicStackedGraph(stackGraph) {
  Object.defineProperty(stackGraph, 'htmlElement', {
    get: () => stackGraph._htmlElement
  });
  Object.defineProperty(stackGraph, 'data', {
    get: () => stackGraph._data
  });
  Object.defineProperty(stackGraph, 'dataDimension', {
    get: () => stackGraph._data[0] ? stackGraph._data[0].length : 0 
  })
}

window.addEventListener('load', event => {
  let stackGraph = new StackedGraph('stacked');
});
