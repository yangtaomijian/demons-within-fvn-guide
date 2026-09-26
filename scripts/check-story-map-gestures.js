// Start the local preview: python3 -m http.server 8765 --directory _site
// Run against it with:
// playwright_cli.sh -s=dw-guide run-code --filename=scripts/check-story-map-gestures.js
async (page) => {
  const results = [];
  const valid = async (svg, label) => {
    const data = await svg.evaluate(node => {
      const b = node.viewBox.baseVal;
      const graph = node.getBBox();
      const attr = node.getAttribute('viewBox');
      const okay = [b.x,b.y,b.width,b.height].every(Number.isFinite) && b.width > 0 && b.height > 0 && !/NaN|Infinity|undefined/.test(attr);
      const visibleX = Math.max(0, Math.min(b.x+b.width,graph.x+graph.width)-Math.max(b.x,graph.x));
      const visibleY = Math.max(0, Math.min(b.y+b.height,graph.y+graph.height)-Math.max(b.y,graph.y));
      const enoughVisible = visibleX / Math.min(b.width,graph.width) >= .75 &&
        visibleY / Math.min(b.height,graph.height) >= .75;
      return {attr,okay,enoughVisible,visibleX,visibleY};
    });
    if (!data.okay || !data.enoughVisible) throw Error(label+': '+JSON.stringify(data));
    return data.attr;
  };
  for (const path of ['guide/choices.html','en/guide/choices.html']) {
    await page.setViewportSize({width:1440,height:900});
    await page.goto('http://127.0.0.1:8765/'+path);
    const inline = page.locator('.dw-story-map-scroll');
    const inlineSvg = inline.locator('svg');
    await inlineSvg.waitFor();
    await page.locator('.dw-map-enhanced').waitFor();
    await inline.evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 120));
    const b=await inline.boundingBox();
    const cx=b.x+Math.min(100,b.width/2), cy=b.y+Math.min(80,b.height/2);
    const emptyBefore=await valid(inlineSvg,path+' initial');
    await page.mouse.move(cx,cy); await page.mouse.down(); await page.mouse.up();
    const emptyAfter=await valid(inlineSvg,path+' empty click');
    if (emptyBefore!==emptyAfter) throw Error('Empty click changed viewBox');
    await page.mouse.move(b.x+b.width-2,cy); await page.mouse.down();
    await page.mouse.move(b.x+b.width+30,cy); await page.mouse.up();
    const afterOutsideRelease=await valid(inlineSvg,path+' release outside map');
    await page.mouse.move(cx,cy); await page.mouse.down(); await page.mouse.up();
    if (await valid(inlineSvg,path+' click after outside release') !== afterOutsideRelease)
      throw Error('Pointer state survived release outside map');
    for (let i=0;i<3;i++) {
      await page.mouse.move(cx,cy); await page.mouse.down(); await page.mouse.move(cx+45,cy+40,{steps:4}); await page.mouse.up();
      await valid(inlineSvg,path+' repeated drag');
      if (await inline.evaluate(node=>node.classList.contains('dw-map-dragging'))) throw Error('Inline grabbing state stuck');
      await page.keyboard.down('Control'); await page.mouse.wheel(0,-45); await page.keyboard.up('Control');
      await valid(inlineSvg,path+' trackpad pinch');
    }
    const beforeScroll=await valid(inlineSvg,path+' before article scroll');
    const pageY=await page.evaluate(() => scrollY);
    await page.mouse.wheel(0,120);
    await page.waitForFunction(previous => scrollY !== previous, pageY);
    if (await valid(inlineSvg,path+' ordinary wheel') !== beforeScroll) throw Error('Article wheel changed map zoom');
    await inline.focus(); await page.keyboard.press('+'); await valid(inlineSvg,path+' keyboard zoom');
    await page.keyboard.press('ArrowRight'); await valid(inlineSvg,path+' keyboard pan');
    await page.keyboard.press('0'); await valid(inlineSvg,path+' keyboard fit');
    const link=inlineSvg.locator('a').first();
    const linkBox=await link.boundingBox();
    if (!linkBox) throw Error('No link box');
    const lx=linkBox.x+linkBox.width/2,ly=linkBox.y+linkBox.height/2;
    await page.mouse.move(lx,ly); await page.mouse.down(); await page.mouse.move(lx+55,ly+30,{steps:4}); await page.mouse.up();
    await valid(inlineSvg,path+' linked drag');
    if (page.url().split('#')[1]) throw Error('Linked drag navigated');
    await link.click();
    if (!page.url().split('#')[1]) throw Error('Linked click did not navigate');
    await page.goto('http://127.0.0.1:8765/'+path);
    await page.locator('.dw-map-enhanced').waitFor();
    await page.locator('.dw-map-expand').click();
    const stage=page.locator('.dw-map-viewer-stage');
    const svg=stage.locator('svg');
    if (!await stage.evaluate(node=>node===document.activeElement)) throw Error('Viewer map did not receive focus');
    const sb=await stage.boundingBox(); const vx=sb.x+sb.width*.5,vy=sb.y+sb.height*.5;
    const viewerInitial=await valid(svg,path+' viewer initial');
    for (let i=0;i<3;i++) {
      await page.mouse.move(vx,vy); await page.mouse.down(); await page.mouse.move(vx+90,vy+60,{steps:4}); await page.mouse.up();
      await valid(svg,path+' viewer repeated drag');
      if (await stage.evaluate(node=>node.classList.contains('dw-map-dragging'))) throw Error('Viewer grabbing state stuck');
      await page.mouse.move(vx,vy); await page.mouse.wheel(0,-120); await valid(svg,path+' mouse wheel zoom');
    }
    const beforeTrackpad=await valid(svg,path+' before trackpad pan');
    await page.mouse.wheel(20,30);
    if (await valid(svg,path+' trackpad pan') === beforeTrackpad) throw Error('Trackpad wheel did not pan');
    const beforePinch=await valid(svg,path+' before viewer pinch');
    await page.keyboard.down('Control'); await page.mouse.wheel(0,-45); await page.keyboard.up('Control');
    if (await valid(svg,path+' viewer pinch') === beforePinch) throw Error('Viewer pinch did not zoom');
    await page.keyboard.press('+'); await valid(svg,path+' keyboard zoom viewer');
    await page.keyboard.press('ArrowDown'); await valid(svg,path+' keyboard pan viewer');
    await page.keyboard.press('f'); await valid(svg,path+' viewer fit');
    const fitWidth=await svg.evaluate(node=>node.viewBox.baseVal.width);
    for (let i=0;i<30;i++) await page.keyboard.press('+');
    const minWidth=await svg.evaluate(node=>node.viewBox.baseVal.width);
    if (minWidth < fitWidth/3.5-.05 || minWidth > fitWidth/3.5+.05) throw Error('Zoom bound failed');
    await page.mouse.move(vx,vy); await page.mouse.down();
    await page.mouse.move(vx+500,vy+250,{steps:4}); await page.mouse.up();
    await valid(svg,path+' extreme pan bounds');
    await page.keyboard.press('0'); await valid(svg,path+' fit recovery');
    const fullscreen=page.locator('.dw-map-viewer-controls button').filter({hasText:path.startsWith('en/')?'Browser fullscreen':'浏览器全屏'});
    if (await page.evaluate(() => document.fullscreenEnabled)) {
      await fullscreen.click();
      await page.waitForFunction(() => !!document.fullscreenElement);
      await valid(svg,path+' fullscreen');
      await fullscreen.click();
      await page.waitForFunction(() => !document.fullscreenElement);
      await valid(svg,path+' exit fullscreen');
    }
    const viewerLink=svg.locator('a').first();
    await viewerLink.click();
    await page.waitForFunction(() => location.hash.length > 1);
    if (await page.locator('.dw-map-viewer').evaluate(node=>node.open)) throw Error('Viewer remained open after link');
    if (!page.url().split('#')[1]) throw Error('Viewer link did not navigate');
    await page.locator('.dw-map-expand').click();
    await page.locator('.dw-map-viewer-controls button').filter({hasText:path.startsWith('en/')?'Close map':'关闭地图'}).click();
    if (await page.locator('.dw-map-viewer').evaluate(node=>node.open)) throw Error('Viewer did not close');
    if (!await page.locator('.dw-map-expand').evaluate(node=>node===document.activeElement)) throw Error('Focus not restored');
    results.push({path,emptyClick:'unchanged',repeatedInlineZoomDrag:'valid',articleWheel:'scrolls',
      keyboard:'valid',linkedDrag:'did not navigate',linkedClick:'navigated',repeatedViewerZoomDrag:'valid',
      trackpadPanAndPinch:'valid',fullscreen:'valid when supported',viewerLink:'closed and navigated',
      closeReopen:'valid',viewerInitial});
  }
  for (const path of ['guide/choices.html','en/guide/choices.html']) {
    await page.setViewportSize({width:1280,height:800});
    await page.goto('http://127.0.0.1:8765/'+path);
    const inline=page.locator('.dw-story-map-scroll');
    const svg=inline.locator('svg');
    await page.locator('.dw-map-enhanced').waitFor();
    await valid(svg,path+' 1280 inline');
    await page.locator('.dw-map-expand').click();
    const stage=page.locator('.dw-map-viewer-stage');
    await valid(stage.locator('svg'),path+' 1280 viewer');
    await page.keyboard.press('Escape');
    if (await page.locator('.dw-map-viewer').evaluate(node=>node.open)) throw Error('Escape did not close viewer');
    results.push({path,width:1280,inline:'valid',viewer:'valid',escape:'closed'});
  }
  return results;
}
