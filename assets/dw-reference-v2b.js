/* V2B-A reference UX prototype. Source facts remain in Mermaid and source tables. */
(() => {
  'use strict';

  const english = document.documentElement.lang.startsWith('en');
  const words = english ? {
    fit: 'Fit', expand: 'Full Interactive Map',
    close: 'Close map', full: 'Browser fullscreen', rotate: 'Rotate your device for a wider view.',
    overview: 'Story overview', page: 'Page', previous: 'Previous page', next: 'Next page',
    select: 'Select an entry to view its unlock condition.', browse: 'Browse all unlock conditions',
    category: 'Category', empty: 'Empty slot', position: '3 columns × 4 rows'
  } : {
    fit: '适合窗口', expand: '完整互动图',
    close: '关闭地图', full: '浏览器全屏', rotate: '横向旋转设备可获得更宽视野。',
    overview: '主线概览', page: '第', previous: '上一页', next: '下一页',
    select: '选择一个条目，即可在此查看解锁条件。', browse: '浏览本类全部解锁条件',
    category: '类别', empty: '空槽', position: '3 列 × 4 行'
  };

  const el = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const norm = text => text.replace(/\s+/g, ' ').trim();

  function initAdaptiveTable(table) {
    if (!table || table.dataset.dwAdaptive) return;
    const heads = [...table.querySelectorAll('thead th')].map(th => norm(th.textContent));
    if (heads.length < 2) return;
    const wrap = table.closest('.dw-table-scroll, .table-responsive, .quarto-bootstrap-table') || table.parentElement;
    table.dataset.dwAdaptive = 'true';
    wrap.classList.add('dw-adaptive-table');
    const rows = [...table.querySelectorAll('tbody tr')];
    rows.forEach(row => [...row.cells].forEach((cell, index) => {
      if (!index) return;
      const label = el('span', 'dw-record-label', heads[index]);
      cell.prepend(label);
    }));
    // Measure the table's actual available width, including narrow desktop columns.
    const update = () => {
      const narrow = wrap.getBoundingClientRect().width < 576;
      wrap.classList.toggle('dw-record-mode', narrow);
      if (narrow) {
        table.setAttribute('role', 'list');
        rows.forEach(row => {
          row.setAttribute('role', 'listitem');
          [...row.cells].forEach(cell => cell.setAttribute('role', 'none'));
        });
      } else {
        table.removeAttribute('role');
        rows.forEach(row => {
          row.removeAttribute('role');
          [...row.cells].forEach(cell => cell.removeAttribute('role'));
        });
      }
    };
    new ResizeObserver(update).observe(wrap);
    update();
  }

  function initStoryMap() {
    const map = document.querySelector('.dw-story-map');
    if (!map) return;
    const source = map.storySource || map.querySelector('pre.mermaid')?.textContent || '';
    const scroller = map.querySelector('.dw-story-map-scroll');
    if (!source || !scroller) return;

    // Node labels and targets come from the only full graph; this small order map
    // describes the linear reading sequence, not a second factual graph.
    const labels = new Map();
    const targets = new Map();
    for (const match of source.matchAll(/^\s*(\w+)\s*(?:\[|\(\[)"([^"\n]+)"/gm)) {
      labels.set(match[1], match[2].replace(/<br\s*\/?\s*>/gi, ' · '));
    }
    for (const match of source.matchAll(/^\s*click\s+(\w+)\s+href\s+"(#[^"]+)"/gm)) {
      targets.set(match[1], match[2]);
    }
    const sequence = [
      ['first'], ['warehouse'], ['normal', 'captured', 'endings'], ['early'],
      ['days'], ['bear', 'tiger'], ['merge'], ['wolf', 'wolfEnd'], ['sloth'],
      ['bath'], ['reprieve'], ['gunther'], ['garret'], ['finish']
    ];
    const requiredEdges = ['days --> bear', 'days --> tiger', 'bear --> merge',
      'tiger --> merge', 'captured --> endings', 'wolf -->|No intervention| wolfEnd'];
    const normalizedSource = source.replace(/\|[^|\n]+\|/g, '').replace(/\s+/g, ' ');
    const valid = sequence.flat().every(id => labels.has(id)) &&
      requiredEdges.every(edge => normalizedSource.includes(edge.replace(/\|[^|]+\|/g, ''))) &&
      [...targets.values()].every(hash => document.getElementById(hash.slice(1)));
    if (!valid) { console.error('Story overview no longer matches the source graph.'); return; }

    const overview = el('section', 'dw-story-overview');
    overview.setAttribute('aria-label', words.overview);
    const list = el('ol', 'dw-story-overview-list');
    sequence.forEach((group, index) => {
      const item = el('li', 'dw-story-overview-step');
      if (group.length > 1) item.classList.add('dw-story-overview-branches');
      group.forEach(id => {
        const target = targets.get(id);
        const node = el(target ? 'a' : 'span', 'dw-story-overview-node', labels.get(id));
        if (target) node.href = target;
        if (id === 'endings' || id === 'wolfEnd') node.classList.add('dw-story-overview-terminal');
        if (index === sequence.length - 1) node.classList.add('dw-story-overview-final');
        item.append(node);
      });
      list.append(item);
    });
    overview.append(list);
    map.before(overview);

    const bar = el('div', 'dw-map-controls');
    const button = (label, action) => {
      const b = el('button', 'dw-map-button', label);
      b.type = 'button'; b.addEventListener('click', action); return b;
    };
    let inlineSvg;
    let inlineBox;
    const graphBoxes = new WeakMap();
    const finiteBox = box => box && [box.x, box.y, box.width, box.height].every(Number.isFinite) &&
      box.width > 0 && box.height > 0;
    const graphBox = svg => {
      if (!graphBoxes.has(svg)) {
        const b = svg.getBBox();
        const box = {x:b.x - 12, y:b.y - 12, width:b.width + 24, height:b.height + 24};
        if (finiteBox(box)) graphBoxes.set(svg, box);
      }
      return graphBoxes.get(svg);
    };
    const viewBox = svg => {
      const b = svg.viewBox.baseVal;
      return {x:b.x, y:b.y, width:b.width, height:b.height};
    };
    const writeBox = (svg, box) => {
      if (!finiteBox(box)) return false;
      svg.setAttribute('viewBox', `${box.x} ${box.y} ${box.width} ${box.height}`);
      return true;
    };
    const fitBox = svg => {
      const graph = graphBox(svg);
      if (!graph) return null;
      if (!svg.closest('.dw-map-viewer')) return graph;
      const rect = svg.getBoundingClientRect();
      const ratio = rect.width / rect.height;
      if (!Number.isFinite(ratio) || ratio <= 0) return graph;
      const width = Math.max(graph.width, graph.height * ratio);
      const height = width / ratio;
      return {x:graph.x + (graph.width - width)/2, y:graph.y + (graph.height - height)/2, width, height};
    };
    const clampNumber = (value, low, high) => Math.min(Math.max(value, low), high);
    const clampBox = (svg, box) => {
      const graph = graphBox(svg);
      if (!graph || !finiteBox(box)) return null;
      const axis = (start, size, graphStart, graphSize) => {
        if (size >= graphSize) {
          const centered = graphStart + (graphSize - size)/2;
          const slack = Math.min(size, graphSize) * .12;
          return clampNumber(start, centered - slack, centered + slack);
        }
        const visible = size * .8;
        return clampNumber(start, graphStart - size + visible, graphStart + graphSize - visible);
      };
      return {...box, x:axis(box.x, box.width, graph.x, graph.width),
        y:axis(box.y, box.height, graph.y, graph.height)};
    };
    const getSvg = () => scroller.querySelector('svg') || document.querySelector('.dw-map-viewer svg');
    const fit = svg => { if (svg) writeBox(svg, fitBox(svg)); };
    const screenInverse = svg => {
      const matrix = svg.getScreenCTM();
      try { return matrix?.inverse() || null; } catch { return null; }
    };
    const screenPoint = (inverse, x, y) => new DOMPoint(x, y).matrixTransform(inverse);
    const zoom = (svg, factor, clientX, clientY) => {
      if (!svg || !Number.isFinite(factor) || factor <= 0) return;
      const before = viewBox(svg);
      const base = fitBox(svg);
      if (!finiteBox(before) || !base) return;
      const width = clampNumber(before.width * factor, base.width / 3.5, base.width);
      const height = before.height * width / before.width;
      const inverse = screenInverse(svg);
      const focal = inverse && Number.isFinite(clientX) && Number.isFinite(clientY) ?
        screenPoint(inverse, clientX, clientY) :
        {x:before.x + before.width/2, y:before.y + before.height/2};
      const xRatio = clampNumber((focal.x - before.x)/before.width, 0, 1);
      const yRatio = clampNumber((focal.y - before.y)/before.height, 0, 1);
      writeBox(svg, clampBox(svg, {x:focal.x - xRatio*width, y:focal.y - yRatio*height, width, height}));
    };
    bar.append(button(words.fit, () => fit(getSvg())));
    const expand = button(words.expand, openViewer);
    expand.classList.add('dw-map-expand');
    bar.append(expand);
    scroller.before(bar);
    const mobileExpand = button(words.expand, openViewer);
    mobileExpand.classList.add('dw-map-mobile-expand');
    overview.append(mobileExpand);

    const dialog = el('dialog', 'dw-story-map dw-map-viewer');
    dialog.setAttribute('aria-label', words.expand);
    const header = el('div', 'dw-map-viewer-header');
    const title = el('strong', '', words.expand);
    const controls = el('div', 'dw-map-viewer-controls');
    const stage = el('div', 'dw-map-viewer-stage');
    const workspace = el('div', 'dw-map-viewer-workspace');
    stage.tabIndex = 0;
    stage.setAttribute('aria-label', words.expand);
    const fullscreen = button(words.full, async () => {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.fullscreenEnabled) await workspace.requestFullscreen();
    });
    if (!document.fullscreenEnabled) fullscreen.hidden = true;
    controls.append(button(words.fit, () => fit(getSvg())), fullscreen,
      button(words.close, () => closeViewer()));
    header.append(title, controls);
    workspace.append(header, stage, el('p', 'dw-map-rotate-hint', words.rotate));
    dialog.append(workspace);
    document.body.append(dialog);
    let opener = null;
    let savedParent = null;
    let savedNext = null;
    let viewerClosing = false;
    function openViewer() {
      const svg = scroller.querySelector('svg');
      if (!svg || dialog.open) return;
      opener = document.activeElement;
      savedParent = svg.parentNode;
      savedNext = svg.nextSibling;
      inlineSvg = svg;
      inlineBox = svg.getAttribute('viewBox');
      stage.append(svg);
      dialog.showModal(); // Native modal behavior makes the page background inert.
      document.body.classList.add('dw-map-viewer-open');
      fit(svg);
      stage.focus(); // The gesture workspace is also the keyboard pan/zoom target.
    }
    async function closeViewer(restore = true) {
      if (!dialog.open || viewerClosing) return;
      viewerClosing = true;
      if (document.fullscreenElement === workspace) await document.exitFullscreen();
      if (inlineSvg && savedParent) {
        savedParent.insertBefore(inlineSvg, savedNext);
        if (inlineBox) inlineSvg.setAttribute('viewBox', inlineBox);
      }
      dialog.close();
      document.body.classList.remove('dw-map-viewer-open');
      if (restore && opener?.isConnected) opener.focus({preventScroll: true});
      viewerClosing = false;
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); closeViewer(); });
    dialog.addEventListener('click', event => {
      const link = event.target.closest?.('a');
      if (!link) return;
      const hash = link.getAttribute('href') || link.getAttribute('xlink:href');
      if (!hash?.startsWith('#')) return;
      event.preventDefault();
      closeViewer(false).then(() => requestAnimationFrame(() => {
        const target = document.getElementById(hash.slice(1));
        if (location.hash === hash) target?.scrollIntoView();
        else location.hash = hash;
        if (target) { target.tabIndex = -1; target.focus({preventScroll:true}); }
      }));
    });
    const attachGestures = (surface, viewer) => {
      const pointers = new Map();
      let gesture = null;
      let suppressClick = false;
      surface.classList.add('dw-map-gesture-ready');
      const beginPan = pointer => {
        const svg = getSvg();
        if (!svg) return null;
        const inverse = screenInverse(svg);
        const box = viewBox(svg);
        return inverse && finiteBox(box) ? {kind:'pending', id:pointer.id,
          x:pointer.x, y:pointer.y, box, inverse} : null;
      };
      const beginPinch = () => {
        const svg = getSvg();
        const points = [...pointers.values()];
        const inverse = svg && screenInverse(svg);
        const box = svg && viewBox(svg);
        if (!inverse || !finiteBox(box) || points.length !== 2) return null;
        const x = (points[0].x + points[1].x)/2;
        const y = (points[0].y + points[1].y)/2;
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (!distance) return null;
        return {kind:'pinch', box, inverse, distance, focal:screenPoint(inverse, x, y)};
      };
      const finish = (event, cancelled = false) => {
        if (!pointers.has(event.pointerId)) return;
        if (!cancelled && (gesture?.kind === 'pan' || gesture?.kind === 'pinch')) {
          suppressClick = true;
          setTimeout(() => { suppressClick = false; }, 0);
        }
        pointers.delete(event.pointerId);
        if (surface.hasPointerCapture(event.pointerId)) surface.releasePointerCapture(event.pointerId);
        surface.classList.remove('dw-map-dragging');
        gesture = pointers.size === 1 ? beginPan([...pointers.values()][0]) : null;
      };
      surface.addEventListener('click', event => {
        if (!suppressClick) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        suppressClick = false;
      }, true);
      surface.addEventListener('pointerdown', event => {
        if (event.pointerType === 'mouse' && event.button !== 0) return;
        if (pointers.has(event.pointerId) || pointers.size >= 2) return;
        const svg = getSvg();
        if (!svg || !finiteBox(viewBox(svg))) return;
        const pointer = {id:event.pointerId, x:event.clientX, y:event.clientY};
        pointers.set(event.pointerId, pointer);
        gesture = pointers.size === 2 ? beginPinch() : beginPan(pointer);
        // Do not capture a mouse press until it becomes a drag: Mermaid links
        // must still receive their ordinary click after a short press.
        if (event.pointerType === 'touch' && !surface.hasPointerCapture(event.pointerId))
          surface.setPointerCapture(event.pointerId);
      });
      surface.addEventListener('pointermove', event => {
        const pointer = pointers.get(event.pointerId);
        if (!pointer || !gesture) return;
        if (event.pointerType === 'mouse' && !(event.buttons & 1)) {
          finish(event, true);
          return;
        }
        pointer.x = event.clientX; pointer.y = event.clientY;
        const svg = getSvg();
        if (!svg) return;
        if (gesture.kind === 'pinch') {
          const points = [...pointers.values()];
          if (points.length !== 2) return;
          const x = (points[0].x + points[1].x)/2;
          const y = (points[0].y + points[1].y)/2;
          const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
          const base = fitBox(svg);
          if (!base || !Number.isFinite(distance) || distance <= 0) return;
          const width = clampNumber(gesture.box.width * gesture.distance / distance, base.width/3.5, base.width);
          const height = gesture.box.height * width / gesture.box.width;
          const atMidpoint = screenPoint(gesture.inverse, x, y);
          const xRatio = (atMidpoint.x - gesture.box.x)/gesture.box.width;
          const yRatio = (atMidpoint.y - gesture.box.y)/gesture.box.height;
          writeBox(svg, clampBox(svg, {x:gesture.focal.x - xRatio*width,
            y:gesture.focal.y - yRatio*height, width, height}));
          surface.classList.add('dw-map-dragging');
          return;
        }
        if (gesture.id !== event.pointerId) return;
        const dx = event.clientX - gesture.x;
        const dy = event.clientY - gesture.y;
        if (gesture.kind === 'pending') {
          if (Math.hypot(dx, dy) < 5) return;
          gesture.kind = 'pan';
          surface.classList.add('dw-map-dragging');
          if (!surface.hasPointerCapture(event.pointerId)) surface.setPointerCapture(event.pointerId);
        }
        const inverse = gesture.inverse;
        writeBox(svg, clampBox(svg, {...gesture.box,
          x:gesture.box.x - inverse.a*dx - inverse.c*dy,
          y:gesture.box.y - inverse.b*dx - inverse.d*dy}));
      });
      surface.addEventListener('pointerup', event => finish(event));
      surface.addEventListener('pointercancel', event => finish(event, true));
      surface.addEventListener('lostpointercapture', event => finish(event, true));
      // A press can be released outside the inline surface before capture begins.
      window.addEventListener('pointerup', event => {
        if (pointers.has(event.pointerId)) finish(event);
      });
      window.addEventListener('pointercancel', event => {
        if (pointers.has(event.pointerId)) finish(event, true);
      });
      surface.addEventListener('wheel', event => {
        const svg = getSvg();
        if (!svg || !finiteBox(viewBox(svg))) return;
        if (!viewer && !event.ctrlKey) return; // Ordinary article wheel scrolling stays native.
        event.preventDefault();
        const mouseWheel = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL ||
          (Math.abs(event.deltaY) >= 80 && Math.abs(event.deltaX) < 2 && Number.isInteger(event.deltaY));
        if (event.ctrlKey || !viewer || mouseWheel) {
          zoom(svg, Math.exp(event.deltaY * .0015), event.clientX, event.clientY);
        } else {
          const b = viewBox(svg);
          const inverse = screenInverse(svg);
          if (inverse) writeBox(svg, clampBox(svg, {...b,
            x:b.x + inverse.a*event.deltaX + inverse.c*event.deltaY,
            y:b.y + inverse.b*event.deltaX + inverse.d*event.deltaY}));
        }
      }, {passive:false});
      surface.addEventListener('keydown', event => {
        const svg = getSvg();
        if (!svg || !finiteBox(viewBox(svg))) return;
        const key = event.key;
        if (key === '+' || key === '=') zoom(svg, .8);
        else if (key === '-') zoom(svg, 1.25);
        else if (key === '0' || key.toLowerCase() === 'f') fit(svg);
        else if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(key)) {
          const b = viewBox(svg);
          const x = key === 'ArrowLeft' ? -.12 : key === 'ArrowRight' ? .12 : 0;
          const y = key === 'ArrowUp' ? -.12 : key === 'ArrowDown' ? .12 : 0;
          writeBox(svg, clampBox(svg, {...b, x:b.x+b.width*x, y:b.y+b.height*y}));
        } else return;
        event.preventDefault();
      });
    };
    attachGestures(stage, true);
    attachGestures(scroller, false);
    new ResizeObserver(() => { if (dialog.open) fit(getSvg()); }).observe(stage);
    // SVG is produced asynchronously by Quarto/Mermaid. Do not hide the source
    // graph until it exists, so the disclosure still works without enhancement.
    const mobile = matchMedia('(max-width: 767.98px)');
    const syncMobile = () => {
      const hidden = mobile.matches && map.classList.contains('dw-map-enhanced');
      map.inert = hidden;
      if (hidden) map.setAttribute('aria-hidden', 'true');
      else map.removeAttribute('aria-hidden');
    };
    mobile.addEventListener('change', syncMobile);
    const ready = () => {
      const svg = scroller.querySelector('svg');
      if (!svg || svg.querySelector('.error-text') || svg.querySelectorAll('a').length < targets.size) return false;
      map.classList.add('dw-map-enhanced');
      overview.classList.add('dw-story-overview-ready');
      syncMobile();
      return true;
    };
    if (!ready()) {
      const observer = new MutationObserver(() => { if (ready()) observer.disconnect(); });
      observer.observe(scroller, {childList:true, subtree:true});
    }
  }

  function initTabs(group, onSelect) {
    const list = group.querySelector(':scope > .dw-tab-list');
    const buttons = [...list.querySelectorAll(':scope > button')];
    const panels = [...group.querySelectorAll(':scope > .dw-tab-panel')];
    list.setAttribute('role', 'tablist');
    const select = (index, focus = false, byUser = false) => {
      buttons.forEach((button, i) => {
        button.setAttribute('aria-selected', String(i === index));
        button.tabIndex = i === index ? 0 : -1;
      });
      panels.forEach((panel, i) => { panel.hidden = i !== index; });
      if (focus) buttons[index].focus();
      onSelect?.(index, byUser);
    };
    buttons.forEach((button, index) => {
      button.setAttribute('role', 'tab');
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', button.id);
      button.addEventListener('click', () => select(index, false, true));
      button.addEventListener('keydown', event => {
        const next = event.key === 'ArrowRight' ? (index+1)%buttons.length :
          event.key === 'ArrowLeft' ? (index-1+buttons.length)%buttons.length :
          event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length-1 : -1;
        if (next < 0) return;
        event.preventDefault(); select(next, true, true);
      });
    });
    select(0);
    return {select, buttons, panels};
  }

  function initMemorium() {
    const locator = document.querySelector('.dw-memory-tabs');
    const conditions = document.querySelector('.dw-condition-tabs');
    const viewer = document.querySelector('.dw-viewer-tabs');
    if (!locator || !conditions || !viewer) return;
    const sourcePanels = [...conditions.querySelectorAll(':scope > .dw-tab-panel')];
    const locatorPanels = [...locator.querySelectorAll(':scope > .dw-tab-panel')];
    const records = new Map();
    const slotMap = new Map();
    const categoryCounts = [];
    try {
      if (sourcePanels.length !== 4 || locatorPanels.length !== 4) throw Error('Expected four Memory categories');
      sourcePanels.forEach((panel, category) => {
        const rows = [...panel.querySelectorAll('tbody tr')];
        categoryCounts.push(rows.length);
        rows.forEach(row => {
          const marker = row.cells[0]?.querySelector('[id^="mem-"]');
          if (!marker || row.cells.length !== 2 || records.has(marker.id)) throw Error('Invalid or duplicate Memory record');
          records.set(marker.id, {marker, row, category, name:norm(marker.textContent), detail:row.cells[1].innerHTML});
        });
      });
      locatorPanels.forEach((panel, category) => {
        const grids = [...panel.querySelectorAll(':scope > .dw-slot-grid')];
        if (!grids.length) throw Error('Missing Memory slot page');
        grids.forEach((grid, page) => {
          if (grid.children.length > 12) throw Error('Memory page exceeds 3 columns × 4 rows');
          [...grid.querySelectorAll('a')].filter(link => link.hash.startsWith('#mem-')).forEach(link => {
            const id = link.hash.slice(1);
            const record = records.get(id);
            if (!record || record.category !== category || slotMap.has(id)) throw Error(`Invalid Memory slot ${id}`);
            slotMap.set(id, {link, category, page});
          });
        });
      });
      if (records.size !== slotMap.size || categoryCounts.some((count, i) =>
        count !== [...slotMap.values()].filter(slot => slot.category === i).length)) throw Error('Memory slots and records differ');
      const ids = [...document.querySelectorAll('main.content [id]')].map(node => node.id);
      if (ids.length !== new Set(ids).size) throw Error('Duplicate fragment IDs');
    } catch (error) {
      console.error('Memory locator enhancement skipped:', error);
      return; // The source tabs/tables remain readable without the enhancement.
    }

    const conditionTabs = initTabs(conditions);
    const pageStates = [];
    let memoryTabs;
    let selectedId = '';
    const clearSelection = () => {
      locator.querySelectorAll('.dw-slot-grid a[aria-current="true"]').forEach(link => link.removeAttribute('aria-current'));
      locator.querySelectorAll('.dw-memory-detail').forEach(detail =>
        detail.replaceChildren(el('p', 'dw-memory-prompt', words.select)));
      selectedId = '';
    };
    const selectCategory = (index, byUser) => {
      conditionTabs.select(index);
      if (pageStates[index]) pageStates[index].show(pageStates[index].current);
      if (byUser) {
        clearSelection();
        if (location.hash.startsWith('#mem-')) history.replaceState(null, '', location.pathname + location.search);
      }
    };
    memoryTabs = initTabs(locator, selectCategory);
    locatorPanels.forEach((panel, category) => {
      const grids = [...panel.querySelectorAll(':scope > .dw-slot-grid')];
      const pages = grids.map((grid, page) => {
        const wrapper = el('div', 'dw-memory-page');
        const caption = grid.previousElementSibling;
        if (caption?.tagName === 'P') caption.before(wrapper);
        else grid.before(wrapper);
        if (caption?.tagName === 'P') wrapper.append(caption);
        wrapper.append(grid);
        const trailing = wrapper.nextElementSibling;
        if (category === 0 && page === 1 && trailing?.tagName === 'P') {
          wrapper.append(trailing);
          trailing.classList.add('dw-memory-empty-note');
        }
        while (grid.children.length < 12) {
          const empty = el('span', 'dw-slot-empty', '—');
          empty.setAttribute('aria-label', words.empty);
          grid.append(empty);
        }
        grid.setAttribute('aria-label', `${words.position}, ${english ? `page ${page+1}` : `第 ${page+1} 页`}`);
        return wrapper;
      });
      const nav = el('div', 'dw-memory-pages');
      const prev = el('button', '', words.previous); prev.type = 'button';
      const next = el('button', '', words.next); next.type = 'button';
      const label = el('span', 'dw-memory-page-label');
      nav.append(prev, label, next);
      if (pages.length > 1) pages[0].before(nav);
      const state = {current:0, show(page) {
        state.current = page;
        pages.forEach((wrapper, i) => wrapper.hidden = i !== page);
        prev.disabled = page === 0; next.disabled = page === pages.length - 1;
        label.textContent = english ? `Page ${page+1} of ${pages.length}` : `第 ${page+1} / ${pages.length} 页`;
      }};
      prev.addEventListener('click', () => state.show(state.current - 1));
      next.addEventListener('click', () => state.show(state.current + 1));
      state.show(0); pageStates.push(state);
      const detail = el('section', 'dw-memory-detail');
      detail.setAttribute('aria-live', 'polite');
      detail.append(el('p', 'dw-memory-prompt', words.select));
      panel.append(detail);
      grids.forEach(grid => grid.addEventListener('click', event => {
        const link = event.target.closest('a');
        if (!link?.hash.startsWith('#mem-') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        selectRecord(link.hash.slice(1), true);
      }));
    });

    const browse = el('details', 'dw-memory-browse');
    browse.append(el('summary', '', words.browse));
    conditions.before(browse); browse.append(conditions);
    conditions.querySelector(':scope > .dw-tab-list').hidden = true;
    records.forEach((record, id) => {
      record.marker.removeAttribute('id');
      record.marker.dataset.referenceId = id;
    });
    conditions.classList.add('dw-conditions-enhanced');
    locator.classList.add('dw-memory-enhanced');

    function revealMinimum(detail) {
      const bounds = detail.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) detail.scrollIntoView({block:'nearest'});
    }
    function selectRecord(id, updateUrl = false) {
      const slot = slotMap.get(id);
      const record = records.get(id);
      if (!slot || !record) return false;
      memoryTabs.select(slot.category);
      pageStates[slot.category].show(slot.page);
      if (selectedId !== id) clearSelection();
      slot.link.setAttribute('aria-current', 'true');
      const detail = locatorPanels[slot.category].querySelector('.dw-memory-detail');
      const heading = el('h3', '', record.name);
      heading.id = id; // Fragment identifies the selected record, not a table row.
      const meta = el('p', 'dw-memory-detail-meta', `${norm(memoryTabs.buttons[slot.category].textContent)} · ${english ? `Page ${slot.page+1}` : `第 ${slot.page+1} 页`}`);
      const body = el('div', 'dw-memory-detail-body'); body.innerHTML = record.detail;
      detail.replaceChildren(heading, meta, body);
      selectedId = id;
      if (updateUrl && location.hash !== `#${id}`) history.replaceState(null, '', `#${id}`);
      requestAnimationFrame(() => revealMinimum(detail));
      return true;
    }
    function revealHash() {
      const id = decodeURIComponent(location.hash.slice(1));
      if (slotMap.has(id)) {
        selectRecord(id);
        requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({block:'nearest'}));
        return;
      }
      const target = document.getElementById(id);
      const panel = target?.closest('.dw-viewer-tabs > .dw-tab-panel');
      if (panel) viewerTabs.select([...viewer.children].filter(x => x.classList?.contains('dw-tab-panel')).indexOf(panel));
    }
    const viewerTabs = initTabs(viewer);
    document.querySelectorAll('.dw-viewer-tabs table, .dw-condition-tabs table').forEach(initAdaptiveTable);
    window.addEventListener('hashchange', revealHash);
    window.addEventListener('popstate', revealHash);
    revealHash();
  }

  const start = () => {
    initStoryMap();
    if (/\/collectibles\/cg\.html$/.test(location.pathname)) initAdaptiveTable(document.querySelector('main.content table'));
    initMemorium();
  };
  if (document.readyState !== 'complete') document.addEventListener('DOMContentLoaded', start, {once:true});
  else start();
})();
