/**
 * Simply draw a stacked graph
 * @class
 * @constructor
 * @param { SVGElement | string } htmlElement A HTML <svg> element to initialize the stacked graph on
 */
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
  this._baseline = index => 0;
  // Data representation
  // [ group1, group2, group3, ... ]
  // For each group:
  // [ x1, x2, x3, x4, ... ]
  this._data = [
    new Array(10).fill(null).map((val, i) => Math.sin(i/20)),
    new Array(10).fill(null).map((val, i) => 1.2*Math.cos(i/23))
  ];
  // Differential of the data
  this._dataDiff = [];
  this.updateDiff = () => {
    this._dataDiff = this._data.map(arr => {
      if(arr.length <= 1) return arr.map(x => 0);
      let result = [];
      let n = arr.length - 1;
      result[0] = arr[1] - arr[0];
      result[n] = arr[n] - arr[n-1];
      for(let i = 1; i < n; i++) result[i] = (arr[i+1] - arr[i-1])/2;
      return result;
    });
  }

  // X range: 0-1, Y range: unscaled
  // Format: [ group1, group2, ... ]
  // For each group: [ [x1, y1], [x2, y2], [x3, y3] ]
  this._dataToDraw = [];

  /**
   * Update drawing data, but do not update the drawing
   * @function
   * @param { boolean } animated  Toggling if the function kick off an animation
   * @param { number }  timing    Timing in milliseconds
   */
  this.updateDrawingData = (animated, timing) => {
    // TODO: Finish this part, note that the kicked-off function & this function should be seperated
    // (This function might be called when an animation is not yet finished)
  }


  // TODO: Coordination conversion between local data & svg coordinate

  // HTML element
  this._htmlElement = htmlElement;
  /** Padding of the coordinate area */
  this.padding = { left: 20, right: 20, top: 10, bottom: 32 };
  /** Graduation spacing */
  this.gradSpacing = 100;
  /** Graduation line height */
  this.gradHeight = 8;

  /**  Horizontal axis tag mapping function */
  this.tagMapping = index => '' + index;

  // Inserting SVG
  this.svgns = 'http://www.w3.org/2000/svg';

  baselineFunctions(this);
  publicStackedGraph(this);
  makeHorizontalAxis(this);
  bindResizeFunctions(this);
}

function baselineFunctions(stackGraph) {
  stackGraph.zeroBase = index => 0;
  stackGraph.themeRiver = index => -0.5 * stackGraph._data.map(arr => arr[index]).reduce((a, b) => a + b);
  stackGraph.wiggle = index => {
    let dg0 = [];
    for(let i = 0; i <= index; i++) {
      dg[i] = stackGraph._dataDiff.map(arr => arr.slice(0, i + 1).reduce((a, b) => a + b))
        .reduce((a, b) => a + b);
    }
    return dg0.reduce((a, b) => a + b);
  }
}

function makeHorizontalAxis(stackGraph) {
  let _this = stackGraph;
  // Horizontal axis line
  _this.horizontalAxis = document.createElementNS(_this.svgns, 'line');
  // Resize behavior
  _this.horizontalAxis.resize = () => {
    _this.horizontalAxis.setAttribute('x1', _this.padding.left);
    _this.horizontalAxis.setAttribute('x2', _this._htmlElement.clientWidth - _this.padding.right);
    _this.horizontalAxis.setAttribute('y1', _this._htmlElement.clientHeight - _this.padding.bottom);
    _this.horizontalAxis.setAttribute('y2', _this._htmlElement.clientHeight - _this.padding.bottom);
  }
  _this.horizontalAxis.style.stroke = '#aaaaaa';
  _this.horizontalAxis.style.strokeWidth = '1px';
  _this.horizontalAxis.classList.add('stacked-h-axis');
  _this._htmlElement.appendChild(_this.horizontalAxis);

  // Horizontal axis graduations
  _this.horizontalGrads = [];
  _this.horizontalGradTags = [];
  // Resize behavior
  _this.horizontalGrads.resize = () => {
    _this.horizontalGrads.forEach(element => _this._htmlElement.removeChild(element));
    _this.horizontalGradTags.forEach(element => _this._htmlElement.removeChild(element));
    _this.horizontalGrads.splice(0, _this.horizontalGrads.length);
    _this.horizontalGradTags.splice(0, _this.horizontalGradTags.length);
    let [ left, right, bottom ] = [ _this.padding.left, _this.padding.right, _this.padding.bottom ];
    let [ width, height ] = [ _this._htmlElement.clientWidth, _this._htmlElement.clientHeight ];
    let n = Math.ceil((width - left - right)/_this.gradSpacing);
    let step = Math.ceil(_this.dataDimension/n);
    if(_this.dataDimension > 500) {
      step = Math.ceil(step/100) * 100;
    } else if(_this.dataDimension > 50) {
      step = Math.ceil(step/10) * 10;
    }
    for(let i = 0; i < n; i++) {
      let grad = document.createElementNS(_this.svgns, 'line');
      let stepLength = (width - left - right) / _this.dataDimension * step;
      grad.setAttribute('x1', left + i * stepLength);
      grad.setAttribute('x2', left + i * stepLength);
      grad.setAttribute('y1', height - bottom - _this.gradHeight);
      grad.setAttribute('y2', height - bottom);
      grad.style.stroke = '#aaaaaa';
      grad.style.strokeWidth = '1px';
      grad.classList.add('stacked-h-grad');
      _this._htmlElement.appendChild(grad);
      _this.horizontalGrads.push(grad);

      let tag = document.createElementNS(_this.svgns, 'text');
      tag.setAttribute('x', left + i * stepLength);
      tag.setAttribute('y', height - bottom - _this.gradHeight + 28);
      tag.setAttribute('text-anchor', 'middle');
      tag.classList.add('stacked-h-tag');
      tag.innerHTML = _this.tagMapping(i * step);
      _this._htmlElement.appendChild(tag);
      _this.horizontalGrads.push(tag);
    }
  }
}

function bindResizeFunctions(stackGraph) {
  ['horizontalAxis', 'horizontalGrads'].map(prop => {
    window.addEventListener('resize', stackGraph[prop].resize);
    stackGraph[prop].resize();
  });
}

// This function defines the public getter/setter of the class
function publicStackedGraph(stackGraph) {
  Object.defineProperty(stackGraph, 'htmlElement', {
    get: () => stackGraph._htmlElement
  });
  Object.defineProperty(stackGraph, 'data', {
    get: () => stackGraph._data,
    set: newVal => { stackGraph._data = newVal; stackGraph.updateDiff(); }
  });
  Object.defineProperty(stackGraph, 'dataDimension', {
    get: () => stackGraph._data[0] ? stackGraph._data[0].length : 0 
  });

}

window.addEventListener('load', event => {
  let stackGraph = new StackedGraph('stacked');
});
