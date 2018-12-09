'use strict';
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
  this._baseline = this.themeRiver;
  // Data representation
  // [ group1, group2, group3, ... ]
  // For each group:
  // [ x1, x2, x3, x4, ... ]
  // The _data array must be non-empty
  this._data = [
    new Array(50).fill(null).map((val, i) => 1.2*(Math.cos(i/15.2) + Math.sin(i/1.2)/3 + 1.6)),
    new Array(50).fill(null).map((val, i) => Math.sin(i/8.6) + 1),
    new Array(50).fill(null).map((val, i) => 1.2*(Math.cos(i/4.2) + Math.sin(i/2)/10 + 1.6))
  ];
  // Differential of the data
  this._dataDiff = [];
  this._updateDiff = () => {
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

  // X range: 0-1, Y range: 0-1
  // Format: [ group1, group2, ... ]
  // For each group: [ [x1, y1], [x2, y2], [x3, y3] ]
  this._dataToDraw = [];
  this._animatedUpdate = (destination, timing) => {
    // Some of the "static" variables are stored in the function object itself
    let self = this._animatedUpdate;
    // Preparing for the animation
    if(timing) {
      self.dest = destination;
      self.startTimestamp = new Date().valueOf();
      self.timing = timing;
      // Increase the dimensions
      let n = destination.length - this._dataToDraw.length;
      for(let i = 0; i < n; i++) {
        let toUnshift = (this._dataToDraw[0] || []).slice();
        this._dataToDraw.unshift(toUnshift);
      }
      let srcDim = this._dataToDraw[0] ? this._dataToDraw[0].length : 0;
      let dstDim = destination[0] ? destination[0].length : 0;

      this._dataToDraw.forEach(arr => {
        for(let i = 0; i < dstDim - srcDim; i++) {
          let toPush = (arr[arr.length - 1] || [0, 0.5]).slice();
          arr.push(toPush);
        }
      });

      // this._dataToDraw.forEach(arr => {
      //   arr.forEach((coord, i, arr) => coord[0] = i/(arr.length-1) || 0);
      // });
      
      self.fromData = this._dataToDraw;
    }
    // It is made sure that the dimension of _dataToDraw is larger than destination
    let nowTimestamp = new Date().valueOf();
    // Normalized progress
    let progress = (nowTimestamp - self.startTimestamp)/self.timing || 0;
    // Quadratic smooth animation
    progress = 1 - (1 - progress) * (1 - progress);
    // Calculate the new data to draw
    this._dataToDraw = self.fromData.map((arr, index) => {
      if(self.dest.length === 0) {
        return arr.map(coord => [ coord[0] * (1 - progress), coord[1] * (1 - progress) ]);
      }
      
      let i = index < self.dest.length ? index : self.dest.length - 1;
      return arr.map((coord, j) => {
        let m = (self.dest[0] || []).length;
        let [ x, y ] = coord;
        let destX = j < m ? self.dest[i][j][0] : self.dest[i][m-1][0];
        let destY = j < m ? self.dest[i][j][1] : self.dest[i][m-1][1];
        return [ x * (1-progress) + destX * progress, y * (1-progress) + destY * progress ];
      });
    });

    if(nowTimestamp - self.startTimestamp <= self.timing) {
      setTimeout(this._animatedUpdate, 20);
    } else { // The animation should be finished, clean up the data to draw
      this._dataToDraw = JSON.parse(JSON.stringify(self.dest));
    }
    // Draw!
    this.drawStacked();
    // Test only:
    // console.log(JSON.stringify(this._dataToDraw));
  }

  // HTML element
  this._htmlElement = htmlElement;
  /** Padding of the coordinate area */
  this.padding = { left: 20, right: 20, top: 10, bottom: 32 };
  /** Colors in use */
  this.colors = [ '#0089A7', '#3AA8C0', '#49D5EE', '#00748D' ];
  /** Graduation spacing */
  this.gradSpacing = 100;
  /** Graduation line height */
  this.gradHeight = 8;
  /** Default animation timing in seconds */
  this.animationTiming = 1000;

  /**  Horizontal axis tag mapping function */
  this.tagMapping = index => '' + index;

  /** Stacked graph DOM elements */
  this.stackedGraphDOMs = [];

  // This function defines the public getter/setter of the class
  publicStackedGraph(this);
  makeHorizontalAxis(this);
  bindResizeBehaviors(this);
}

StackedGraph.prototype.svgns = 'http://www.w3.org/2000/svg';
/**
 * Update drawing data, but do not update the drawing
 * @function
 * @param { boolean } animated  Toggling if the function kick off an animation
 * @param { number }  timing    Timing in milliseconds
 */
StackedGraph.prototype.updateDrawing = function (animated, timing) {
  // Destination
  // Copy the data array
  let dest = JSON.parse(JSON.stringify(this._data));
  // Push the baseline to the first element
  dest.unshift(new Array(this.dataDimension).fill(null).map((val, i) => this._baseline(i)));
  // Accumulate
  for(let i = 1; i < dest.length; i++) dest[i] = dest[i].map((x, j) => x + dest[i-1][j]);
  // Normalizing
  let max = Math.max.apply(this, dest.map(arr => Math.max.apply(this, arr)));
  let min = Math.min.apply(this, dest.map(arr => Math.min.apply(this, arr)));
  dest = dest.map(arr => arr.map((x, i, arr) => [i/(arr.length-1) || 0, (x - min)/(max - min) || 0]));
  // Commit data changes or kick off animation
  if(!animated) {
    this._dataToDraw = dest;
    this.drawStacked();
  } else {
    this._animatedUpdate(dest, timing);
  }
  this.horizontalGrads.resize();
}

// Coordination conversion between local data & svg coordinate
/**
 * Convert local coordinate to global coordinate (relative to the <svg> element)
 * @function
 * @param { number[] } xy   Local coordinate
 */
StackedGraph.prototype.local2global = function (xy) {
  let [ w, h ] = [
    this._htmlElement.clientWidth || this._htmlElement.parentNode.clientWidth,
    this._htmlElement.clientHeight || this._htmlElement.parentNode.clientHeight ];
  let [ l, r, t, b ] = [ this.padding.left, this.padding.right, this.padding.top, this.padding.bottom ];
  let [ x, y ] = xy;
  return [ x*(w-r-l)+l, y*(-h+2*t+b)+h-t-b ];
}
/**
 * Convert global coordinate to noramalized local coordinate
 * @function
 * @param { number[] } xy   Global coordinate
 */
StackedGraph.prototype.global2local = function (xy) {
  let [ w, h ] = [
    this._htmlElement.clientWidth || this._htmlElement.parentNode.clientWidth,
    this._htmlElement.clientHeight || this._htmlElement.parentNode.clientHeight ];
  let [ l, r, t, b ] = [ this.padding.left, this.padding.right, this.padding.top, this.padding.bottom ];
  let [ x, y ] = xy;
  return [ (x-l)/(w-r-l) || 0, (y-h+t+b)/(-h+2*t+b) || 0 ];
}

// A few baseline functions
StackedGraph.prototype.zeroBase = function(index) { return 0; };
StackedGraph.prototype.themeRiver = function(index) { return -0.5 * this._data.map(arr => arr[index]).reduce((a, b) => a + b); };
StackedGraph.prototype.wiggle = function(index) {
  if(!(this._dataDiff || []).length) this._updateDiff(); 
  var dg0 = this.wiggle.dg0;
  if(this.wiggle.data !== this._data) {
    this.wiggle.data = this._data;
    dg0 = this.wiggle.dg0 = this._dataDiff.map((arr, i, _dataDiff) => 
      arr.map(val => -val*(_dataDiff.length-i)))
        .reduce((a, b) => a.map((val, i) => val + b[i]));
  }
  return dg0.slice(0, index + 1).reduce((a, b) => a + b)/((this._data.length + 1) || 1);
}
StackedGraph.prototype.weightedWiggle = function(index) {
  if(!this._dataDiff.length) this._updateDiff();
  var dg0 = this.weightedWiggle.dg0;
  if(this._data !== this.weightedWiggle.data) {
    this.weightedWiggle.data = this._data;
    let sfi = this._data.reduce((a, b) => a.map((val, i) => val + b[i]));
    dg0 = this.weightedWiggle.dg0 = this._dataDiff.map((dfi, i, _dataDiff) => {
      let sdfj = _dataDiff.slice(0, i + 1).reduce((a, b) => a.map((val, i) => val + b[i]));
      let fi = this._data[i];
      return sdfj.map((val, i) => (val - dfi[i]/2)*fi[i]);
    }).reduce((a, b) => a.map((val, i) => val + b[i])).map((val, i) => -val/sfi[i]);
  }
  return dg0.slice(0, index + 1).reduce((a, b) => a + b);
}
StackedGraph.prototype.getColor = function(index) {
  return this.colors[ index % this.colors.length ] || '#000000';
}
/** Update the drawing */
StackedGraph.prototype.drawStacked = function() {
  // Remove the drawn elements
  this.stackedGraphDOMs.forEach(element => this._htmlElement.removeChild(element));
  this.stackedGraphDOMs.splice(0, this.stackedGraphDOMs.length);
  
  let getColor = index => this.getColor(index-1);
  // Draw the data to draw
  for(let i = 1; i < this._dataToDraw.length; i++) {
    let polygon = document.createElementNS(this.svgns, 'polygon');
    let data = this._dataToDraw[i].map(point => this.local2global(point));
    let data0 = this._dataToDraw[i - 1].map(point => this.local2global(point));
    let points = data.map(point => '' + point[0] + ',' + point[1]).reduce((a, b) => a + ' ' + b);
    points += ' ' + data0.map(point => '' + point[0] + ',' + point[1]).reduceRight((a, b) => a + ' ' + b);
    polygon.setAttribute('points', points);
    polygon.style.fill = getColor(i);
    polygon.classList.add('stacked-polygon', 'stacked-' + (i - 1));
    let wrapEvent = event => {
      event.stackedIndex = i - 1;
      let width = this._htmlElement.clientWidth || this._htmlElement.parentNode.clientWidth;
      let offsetX   = event.offsetX || ((event.targetTouches[0] || {pageX:0}).pageX - event.target.getBoundingClientRect().left);
      let relativeX = (offsetX - this.padding.left)/(width - this.padding.left - this.padding.right) || 0;
      let dataIndex = Math.round(relativeX * (this.dataDimension - 1));
      let newEvent = new CustomEvent('stacked-' + event.type);
      newEvent.dataIndex   = dataIndex;
      newEvent.stackedData = this._data[i-1][dataIndex];
      for(let prop in event) {
        if(typeof newEvent[prop] === 'undefined') newEvent[prop] = event[prop];
      }
      this._htmlElement.dispatchEvent(newEvent);
    };
    // Binding events
    [ 'mousedown', 'mouseenter', 'mouseleave', 'mousemove',
      'mouseout', 'mouseover', 'mouseup', 'mousewheel',
      'touchstart', 'touchend', 'touchcancel', 'touchmove' ].forEach(eventType => {
        let eventHandler = event => wrapEvent(event);
        polygon.addEventListener(eventType, eventHandler);
    });
    // Add polygon to the view
    this.stackedGraphDOMs.push(polygon);
    this._htmlElement.appendChild(polygon);
  }
}

function makeHorizontalAxis(stackedGraph) {
  let _this = stackedGraph;
  // Horizontal axis line
  _this.horizontalAxis = document.createElementNS(_this.svgns, 'line');
  let width  = _this._htmlElement.clientWidth  || _this._htmlElement.parentNode.clientWidth;
  let height = _this._htmlElement.clientHeight || _this._htmlElement.parentNode.clientHeight;
  // Resize behavior
  _this.horizontalAxis.resize = () => {
    _this.horizontalAxis.setAttribute('x1', _this.padding.left);
    _this.horizontalAxis.setAttribute('x2', width - _this.padding.right);
    _this.horizontalAxis.setAttribute('y1', height - _this.padding.bottom);
    _this.horizontalAxis.setAttribute('y2', height - _this.padding.bottom);
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
    let n = Math.ceil((width - left - right)/_this.gradSpacing || 0);
    let step = Math.ceil(_this.dataDimension/n || 0);
    if(_this.dataDimension > 500) {
      step = Math.ceil(step/100) * 100;
    } else if(_this.dataDimension > 50) {
      step = Math.ceil(step/10) * 10;
    } else if(_this.dataDimension > 25) {
      step = Math.ceil(step/5) * 5;
    }
    for(let i = 0; i < n; i++) {
      let grad = document.createElementNS(_this.svgns, 'line');
      let stepLength = (width - left - right) / _this.dataDimension * step || 0;
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

function bindResizeBehaviors(stackedGraph) {
  ['horizontalAxis', 'horizontalGrads'].map(prop => {
    window.addEventListener('resize', stackedGraph[prop].resize);
    stackedGraph[prop].resize();
  });
  window.addEventListener('resize', event => stackedGraph.updateDrawing());
}

// This function defines the public getter/setter of the class
function publicStackedGraph(stackedGraph) {
  Object.defineProperty(stackedGraph, 'dom', {
    get: () => stackedGraph._htmlElement
  });
  Object.defineProperty(stackedGraph, 'htmlElement', {
    get: () => stackedGraph._htmlElement
  });
  Object.defineProperty(stackedGraph, 'data', {
    get: () => stackedGraph._data,
    set: newVal => {
      // Check data validity
      if(!newVal.length) newVal = [[0, 0]];
      let validator = newVal.map(
        arr => [ arr.map(val => typeof val === 'number' ? 1 : 0).reduce((a, b) => a + b), arr.length ]);
      for(let i = 0; i < validator.length - 1; i++) {
        if(validator[i][0] !== validator[i+1][0] || validator[i][1] !== validator[i+1][1]) {
          console.warn('Invalid stacked graph data.');
          return;
        }
      }
      stackedGraph._data = newVal;
      stackedGraph._updateDiff();
      stackedGraph.updateDrawing(true, stackedGraph.animationTiming);
    }
  });
  Object.defineProperty(stackedGraph, 'dataDimension', {
    get: () => stackedGraph._data[0] ? stackedGraph._data[0].length : 0 
  });
  Object.defineProperty(stackedGraph, 'baseline', {
    set: newVal => {
      switch(newVal.toLowerCase()) {
        case 'theme': case 'themeriver': stackedGraph._baseline = stackedGraph.themeRiver; break;
        case 'wiggle': stackedGraph._baseline = stackedGraph.wiggle; break;
        case 'weighted': case 'weightedwiggle': stackedGraph._baseline = stackedGraph.weightedWiggle; break;
        case 'zero': case 'default': default: stackedGraph._baseline = stackedGraph.zeroBase; break;
      }
      stackedGraph.updateDrawing(true, stackedGraph.animationTiming);
    }
  });
}

// CustomEvent polyfill
(function () {
  if ( typeof window.CustomEvent === "function" ) return false;
  function CustomEvent ( event, params ) {
    params = params || { bubbles: false, cancelable: false, detail: undefined };
    var evt = document.createEvent( 'CustomEvent' );
    evt.initCustomEvent( event, params.bubbles, params.cancelable, params.detail );
    return evt;
   }
  CustomEvent.prototype = window.Event.prototype;
  window.CustomEvent = CustomEvent;
})();
