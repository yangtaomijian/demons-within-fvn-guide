---
title: "辞书与 Sprite Viewer 查漏"
description: "心魔在焉 Public 14.6 的辞书条目与 Sprite Viewer 状态查漏条件。"
toc: true
toc-depth: 3
search: false
---

本页整理 *心魔在焉* **Public 14.6** 主线中的辞书与 Sprite Viewer 查漏条件。两者是不同记录：辞书收录人物、事件、环境与派系条目；Sprite Viewer 则在角色条目之外记录可查看的表情、衣着或特殊形态。这里不直接搬运辞书正文或游戏素材，但会涉及剧情剧透。

[跳到辞书](#memorium) · [跳到 Sprite Viewer](#sprite-viewer)

## 辞书 {#memorium}

当前主线共有 **42 个辞书条目**：14 个角色、11 个事件、10 个环境和 7 个派系。其中 36 个要在正文中看到对应高亮词后**主动点击**；另外 6 个由剧情自动解锁。

打开游戏内“记闻”中的“辞书”，确认类别、页码和空缺所在的行列，再点下表中的条目查看解锁条件。每页 **3 列 × 4 行**，从左到右、从上到下排列；「—」表示该位置没有条目。

:::: {.dw-lookup-tabs .dw-memory-tabs}

<div class="dw-tab-list" aria-label="辞书类别">
<button type="button" id="memory-tab-characters" aria-controls="memory-panel-characters">角色 14 条目</button>
<button type="button" id="memory-tab-events" aria-controls="memory-panel-events">事件 11 条目</button>
<button type="button" id="memory-tab-environments" aria-controls="memory-panel-environments">环境 10 条目</button>
<button type="button" id="memory-tab-factions" aria-controls="memory-panel-factions">派系 7 条目</button>
</div>

::: {.dw-tab-panel #memory-panel-characters}

**角色 Page 1**

```{=html}
<div class="dw-slot-grid">
<a href="#mem-resnick">Resnick</a>
<a href="#mem-ludwig">Ludwig</a>
<a href="#mem-edwin">Edwin</a>
<a href="#mem-sam">Sam</a>
<a href="#mem-garret">Garret</a>
<a href="#mem-gunther">Gunther</a>
<a href="#mem-jen">Jen</a>
<a href="#mem-helen">Helen</a>
<a href="#mem-jayden">Jayden</a>
<a href="#mem-boris">Boris</a>
<a href="#mem-red-eyes-wolf">红眼狼</a>
<a href="#mem-red-eyes-fox">红眼狐狸</a>
</div>
```

**角色 Page 2**

```{=html}
<div class="dw-slot-grid">
<a href="#mem-russel">Russel</a>
<a href="#mem-brigham">Brigham</a>
<span class="dw-slot-empty" aria-label="空槽">—</span>
</div>
```

第 2–4 行为空。

:::

::: {.dw-tab-panel #memory-panel-events}

**事件**

```{=html}
<div class="dw-slot-grid">
<a href="#mem-dawn-tournament">破晓竞技赛</a>
<a href="#mem-spare-days">休息日</a>
<a href="#mem-resnick-s-favorite-book">Resnick喜欢的书</a>
<a href="#mem-prank-on-edwin">捉弄Edwin</a>
<a href="#mem-fishing-with-father">与父亲一起钓鱼</a>
<a href="#mem-bacon-in-the-water">水中培根</a>
<a href="#mem-russel-s-best-prank">Russel最棒的恶作剧</a>
<a href="#mem-meeting-sam">遇见Sam</a>
<a href="#mem-passing-out-in-the-baths">晕倒在浴室</a>
<a href="#mem-captain-s-worst-punishment">队长最烂的惩罚</a>
<a href="#mem-scary-sounds-at-night">夜中怪声</a>
<span class="dw-slot-empty" aria-label="空槽">—</span>
</div>
```

:::

::: {.dw-tab-panel #memory-panel-environments}

**环境**

```{=html}
<div class="dw-slot-grid">
<a href="#mem-infirmary">疗养处</a>
<a href="#mem-resnick-s-bedroom">Resnick的宿舍</a>
<a href="#mem-baths">浴室</a>
<a href="#mem-inner-courtyard">中庭</a>
<a href="#mem-heirdall-city">Heirdall城</a>
<a href="#mem-heirdall-library">Heirdall图书馆</a>
<a href="#mem-the-weary-soldier">疲兵酒馆</a>
<a href="#mem-old-warehouse">旧仓库</a>
<a href="#mem-the-marshlands">沼泽地</a>
<a href="#mem-the-capital">首都</a>
<span class="dw-slot-empty" aria-label="空槽">—</span>
<span class="dw-slot-empty" aria-label="空槽">—</span>
</div>
```

:::

::: {.dw-tab-panel #memory-panel-factions}

**派系**

```{=html}
<div class="dw-slot-grid">
<a href="#mem-dawnbreak-order">破晓骑士团</a>
<a href="#mem-red-eyes">红眼怪</a>
<a href="#mem-grand-marshall-alistair">Alistair团长</a>
<a href="#mem-earning-a-name">取得生前名</a>
<a href="#mem-commander-arlington">Arlington指挥官</a>
<a href="#mem-dawnbreak-elites">破晓精英小队</a>
<a href="#mem-exalted-donations">崇高之捐赠</a>
<span class="dw-slot-empty" aria-label="空槽">—</span>
<span class="dw-slot-empty" aria-label="空槽">—</span>
</div>
```

:::

::::

### 容易漏掉的路线 {#memorium-missables}

- **Bear Day 有 6 个路线限定条目：**Jen、Heirdall图书馆、沼泽地、红眼怪、Resnick喜欢的书、捉弄Edwin。
- **捉弄Edwin 与 Ludwig 的后半互动 Viewer 需要分支回看：**前三处桌边窗口任一处不干预，才能在阅读收尾点击捉弄Edwin；前三处都选色欲才会进入后半互动并取得对应 Viewer 状态。已经进入后半互动后，最后两处是否干预都不会回到捉弄Edwin 所在的阅读收尾。建议从桌边第一处窗口前重走。
- **Tiger Day 有 3 个路线限定条目：**Helen、Jayden、疲兵酒馆。Boris 在 Tiger Day 较早出现，但后来的共同主线还有一次可点击机会，因此不属于只能在 Tiger Day 取得的条目。
- 要比较 Bear Day 与 Tiger Day，需读取选择 Edwin 或 Ludwig 休假日前的存档；进入方式与存档建议见[休假日分流](../guide/choices.qmd#day-off)。
- **崇高之捐赠** 还受 Sam 那一轮操作影响：先到达对应提问，再选择不干预并点击词条，缺一不可。

::: {.callout-note title="已知限制" #memorium-limit}
Public 14.6 已修复红眼狼与红眼狐狸的辞书记录问题，并加入旧记录兼容支持。

尚未实测：辞书与 Viewer 新解锁记录的跨重启保留、14.0 旧记录升级后的列表刷新与再次启动显示，以及 Viewer 入口操作。
:::

:::: {.dw-lookup-tabs .dw-condition-tabs}

<div class="dw-tab-list" aria-label="辞书详细解锁条件">
<button type="button" id="condition-tab-characters" aria-controls="condition-panel-characters">角色 14</button>
<button type="button" id="condition-tab-events" aria-controls="condition-panel-events">事件 11</button>
<button type="button" id="condition-tab-environments" aria-controls="condition-panel-environments">环境 10</button>
<button type="button" id="condition-tab-factions" aria-controls="condition-panel-factions">派系 7</button>
</div>

::: {.dw-tab-panel #condition-panel-characters}

<div id="memorium-characters"></div>

| 条目 | 出现位置与操作 |
|---|---|
| [Resnick]{#mem-resnick} | 康复开场，在医务室点击指向他本人的高亮词。 |
| [Ludwig]{#mem-ludwig} | 康复开场，Ludwig 守在病床边时点击名字。 |
| [Edwin]{#mem-edwin} | 康复期间，Edwin 来到医务室窗口时点击名字。 |
| [Sam]{#mem-sam} | 仓库事件后在医务室醒来、Sam 为 Resnick 检查时点击名字。 |
| [Garret]{#mem-garret} | 仓库初战前，Resnick 到队长办公室汇报时点击名字。 |
| [Gunther]{#mem-gunther} | 仓库事件后的医务室汇报中点击名字。 |
| [Jen]{#mem-jen} | 进入 Ludwig 的 Bear Day，在 Heirdall图书馆前台见到她时点击名字。 |
| [Helen]{#mem-helen} | 进入 Edwin 的 Tiger Day，在酒馆后段见到她时点击名字。 |
| [Jayden]{#mem-jayden} | 进入 Tiger Day，第一次在酒馆见到他时点击名字。 |
| [Boris]{#mem-boris} | Tiger Day 初见时可以点击；若当时漏掉，后来的共同主线还会在疲兵酒馆再次出现可点击名字。 |
| [红眼狼]{#mem-red-eyes-wolf} | 从黑狼伏击继续到懒惰主线，在后续说明两名红眼怪的文字中点击对应名字。14.6 修复与旧记录升级说明见[已知限制](#memorium-limit)。 |
| [红眼狐狸]{#mem-red-eyes-fox} | 与红眼狼同一段出现，需单独点击对应名字。14.6 修复与旧记录升级说明见[已知限制](#memorium-limit)。 |
| [Russel]{#mem-russel} | 懒惰转折后的共同主线中，Resnick 与兄长重逢时点击名字。 |
| [Brigham]{#mem-brigham} | 市场事件后的 Fated Encounter 中由剧情自动解锁，不需要点击名字。 |


:::

::: {.dw-tab-panel #condition-panel-events}

<div id="memorium-events"></div>

| 条目 | 出现位置与操作 |
|---|---|
| [破晓竞技赛]{#mem-dawn-tournament} | 康复期间谈到骑士团的比赛时点击高亮词。 |
| [休息日]{#mem-spare-days} | 仓库事件后的浴场谈话中，众人讨论休假日时点击高亮词。 |
| [Resnick喜欢的书]{#mem-resnick-s-favorite-book} | Bear Day 的图书馆内，Ludwig 回来后一起挑书时点击书名。 |
| [捉弄Edwin]{#mem-prank-on-edwin} | Bear Day 图书馆桌边连续互动的前三处中，任一处不干预，随后进入阅读收尾并点击两人回忆旧事时出现的高亮词。若前三处都选择色欲，剧情会进入另一种收尾并绕开该链接。 |
| [与父亲一起钓鱼]{#mem-fishing-with-father} | Day of Reprieve 的河边钓鱼段，兄弟谈起童年时点击高亮词。 |
| [水中培根]{#mem-bacon-in-the-water} | 同一段河边回忆中点击高亮词。 |
| [Russel最棒的恶作剧]{#mem-russel-s-best-prank} | Day of Reprieve 的河边闲谈推进到一组往事回忆时自动解锁。 |
| [遇见Sam]{#mem-meeting-sam} | 与上一项在同一段剧情自动解锁。 |
| [晕倒在浴室]{#mem-passing-out-in-the-baths} | 与上一项在同一段剧情自动解锁。 |
| [队长最烂的惩罚]{#mem-captain-s-worst-punishment} | 与上一项在同一段剧情自动解锁。 |
| [夜中怪声]{#mem-scary-sounds-at-night} | 与上一项在同一段剧情自动解锁。 |


:::

::: {.dw-tab-panel #condition-panel-environments}

<div id="memorium-environments"></div>

| 条目 | 出现位置与操作 |
|---|---|
| [疗养处]{#mem-infirmary} | 康复开场，Resnick 辨认所在房间时点击地点。 |
| [Resnick的宿舍]{#mem-resnick-s-bedroom} | 康复后的第一晚回到卧室时点击地点。 |
| [浴室]{#mem-baths} | 仓库事件后去哨所浴场时点击地点。 |
| [中庭]{#mem-inner-courtyard} | 康复期间从医务室窗口望向院内时点击地点。 |
| [Heirdall城]{#mem-heirdall-city} | 仓库初战前重新外出巡逻时点击城市名。 |
| [Heirdall图书馆]{#mem-heirdall-library} | 进入 Bear Day、抵达图书馆后点击地点。 |
| [疲兵酒馆]{#mem-the-weary-soldier} | 进入 Tiger Day、抵达酒馆后点击地点。 |
| [旧仓库]{#mem-old-warehouse} | 仓库事件后的医务室汇报中点击地点。 |
| [沼泽地]{#mem-the-marshlands} | Bear Day 独自调查红眼怪资料时点击地点；若独自查资料时选择色欲，会绕开这段文字。 |
| [首都]{#mem-the-capital} | 懒惰转折后的共同主线中，与 Russel 清理哨所并谈到首都时点击地点。 |


:::

::: {.dw-tab-panel #condition-panel-factions}

<div id="memorium-factions"></div>

| 条目 | 出现位置与操作 |
|---|---|
| [破晓骑士团]{#mem-dawnbreak-order} | 康复期间从医务室望向训练院时点击组织名。 |
| [红眼怪]{#mem-red-eyes} | Bear Day 独自调查资料时点击派系名；若独自查资料时选择色欲，会绕开这段文字。 |
| [Alistair团长]{#mem-grand-marshall-alistair} | 懒惰转折后的共同主线中，Russel 首次到来并谈起骑士团时点击名字。 |
| [取得生前名]{#mem-earning-a-name} | 同一段共同主线中，众人谈到获得第二个名字时点击高亮词。 |
| [Arlington指挥官]{#mem-commander-arlington} | 后来的长官浴场谈话中点击名字。 |
| [破晓精英小队]{#mem-dawnbreak-elites} | Day of Reprieve 河边谈到骑士团精锐时点击高亮词。 |
| [崇高之捐赠]{#mem-exalted-donations} | 真心话大冒险轮到 Sam 提问时**不干预**，随后点击出现的高亮词。选择色欲会改成另一组问题并绕开它；详见[Sam 的条目机会](../guide/choices.qmd#truth-or-dare)。 |


:::

::::

## Sprite Viewer {#sprite-viewer}

本页列出 **23 组 Sprite Viewer 状态**：其中 22 组可随当前正常主线解锁，另有 1 组目前没有已知的正常主线取得方法。每组可包含多个表情、衣着或身体状态，与角色的辞书条目分开解锁。

Viewer 的入口在辞书的角色条目中，需要先解锁相应条目，再打开角色介绍并点击眼睛图标。

到达下表对应剧情后，Viewer 状态会自动解锁，无需点击正文高亮词。尚未实测的项目见[已知限制](#memorium-limit)。

<div id="sprite-common"></div>
<div id="sprite-route"></div>

:::: {.dw-lookup-tabs .dw-viewer-tabs}

<div class="dw-tab-list" aria-label="Viewer 角色">
<button type="button" id="viewer-tab-resnick" aria-controls="viewer-panel-resnick">Resnick</button>
<button type="button" id="viewer-tab-ludwig" aria-controls="viewer-panel-ludwig">Ludwig</button>
<button type="button" id="viewer-tab-edwin" aria-controls="viewer-panel-edwin">Edwin</button>
<button type="button" id="viewer-tab-sam" aria-controls="viewer-panel-sam">Sam</button>
<button type="button" id="viewer-tab-garret" aria-controls="viewer-panel-garret">Garret</button>
<button type="button" id="viewer-tab-gunther" aria-controls="viewer-panel-gunther">Gunther</button>
<button type="button" id="viewer-tab-boris" aria-controls="viewer-panel-boris">Boris</button>
<button type="button" id="viewer-tab-jayden" aria-controls="viewer-panel-jayden">Jayden</button>
<button type="button" id="viewer-tab-russel" aria-controls="viewer-panel-russel">Russel</button>
<button type="button" id="viewer-tab-red-eyes-wolf" aria-controls="viewer-panel-red-eyes-wolf">红眼狼</button>
</div>

::: {.dw-tab-panel #viewer-panel-resnick}

<div id="viewer-resnick"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Resnick：第一晚状态]{#sprite-resnick-first-night} | 完成康复后的第一晚并进入共同收尾时自动解锁；双轮选谁、最后一处是否干预都不改变这组解锁。 |
| [Resnick：浴场状态]{#sprite-resnick-baths} | 完成仓库事件后的哨所浴场段，在休假日分流前的共同收尾解锁。 |
| [Resnick：营地状态]{#sprite-resnick-camp} | Day of Reprieve 推进到营地段收尾时解锁。 |
| [Resnick：仓库战斗状态]{#sprite-resnick-warehouse-battle} | 仓库初战必须走正常继续：前两处非锁定窗口都选择色欲，再完成四次锁定操作。被俘结果不会解锁这组。 |
| [Resnick：战斗形态]{#sprite-resnick-battle-form} | 仓库初战走正常继续，在正常变身收尾解锁；前两处非锁定窗口都选择色欲，再完成四次锁定操作。 |
| [Resnick：色欲形态]{#sprite-resnick-lust-form} | 仓库初战走正常继续，在正常变身收尾解锁；前两处非锁定窗口都选择色欲，再完成四次锁定操作。完整操作见[仓库初战](../guide/choices.qmd#warehouse)。 |


:::

::: {.dw-tab-panel #viewer-panel-ludwig}

<div id="viewer-ludwig"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Ludwig：浴场状态]{#sprite-ludwig-baths} | 完成仓库事件后的哨所浴场段，在休假日分流前的共同收尾解锁。 |
| [Ludwig：Bear Day 特殊表情]{#sprite-ludwig-bear-day-expression} | 先进入 Bear Day。图书馆桌边连续互动的前三处都选择色欲；第四处以 Ludwig 为目标时也选择色欲，剧情随即解锁这组。这样会走后半互动，不能在同一次流程进入捉弄Edwin 所在的阅读收尾。 |
| [Ludwig：Bear Day 其他状态]{#sprite-ludwig-bear-day-states} | 同样先完成桌边前三处色欲并进入后半互动；把该段走到收尾时解锁。若要在一次流程取得 Ludwig 两组，第四处也选择色欲，再完成场景。逐窗口关系与捉弄Edwin 分支见[Bear Day 图书馆](../guide/choices.qmd#bear-library)。 |
| [Ludwig：懒惰形态]{#sprite-ludwig-sloth-form} | 黑狼伏击时选择色欲继续主线，再走完懒惰能力段的七个锁定阶段，其中三次懒惰自动推进、四次色欲需要手动选择；在后续对 Sam 使用懒惰的剧情中解锁。进入方式见[黑狼伏击与懒惰转折](../guide/choices.qmd#black-wolf)。 |


:::

::: {.dw-tab-panel #viewer-panel-edwin}

<div id="viewer-edwin"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Edwin：第一晚状态]{#sprite-edwin-first-night} | 完成康复后的第一晚并进入共同收尾时自动解锁；双轮选谁、最后一处是否干预都不改变这组解锁。 |
| [Edwin：浴场状态]{#sprite-edwin-baths} | 完成仓库事件后的哨所浴场段，在休假日分流前的共同收尾解锁。 |


:::

::: {.dw-tab-panel #viewer-panel-sam}

<div id="viewer-sam"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Sam：浴场毛巾状态]{#sprite-sam-bath-towel} | 懒惰转折后的共同主线抵达哨所浴场时解锁。 |
| [Sam：浴场内衣状态]{#sprite-sam-bath-underwear} | 沿同一段浴场剧情继续到第二次展示时解锁；这是与上一项分开的目标。 |
| [Sam：营地状态]{#sprite-sam-camp} | Day of Reprieve 推进到营地段收尾时解锁。 |


:::

::: {.dw-tab-panel #viewer-panel-garret}

<div id="viewer-garret"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Garret：浴场状态]{#sprite-garret-baths} | 完成仓库事件后的哨所浴场段，在休假日分流前的共同收尾解锁；这是前期哨所浴场，不是后来的长官浴场。 |
| [Garret：便服状态]{#sprite-garret-casual} | 进入黑狼伏击章节的较早展示时解锁，发生在决定伏击结果的本源之轮之前。 |


:::

::: {.dw-tab-panel #viewer-panel-gunther}

<div id="viewer-gunther"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Gunther：二次战状态]{#sprite-gunther-second-battle} | 完成市场后的 Gunther 二次战并进入随后共同遭遇时解锁；三种本源之轮操作都会到达这一共同段。 |


:::

::: {.dw-tab-panel #viewer-panel-boris}

<div id="viewer-boris"></div>

<div id="sprite-unavailable"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Boris：Tiger Day 状态]{#sprite-boris-tiger-day} | 先进入 Tiger Day；酒馆后方的较早窗口选择色欲，把访客确定为 Boris。私人房间后段还要选择色欲开门，并在 Boris 自己的窗口再次选择色欲，之后才解锁。 |
| [Boris：便服状态]{#sprite-boris-casual} | 这组衣着单独列出，但 Public 14.6 目前没有已知的正常主线取得方法。不要把它当作可以通过 Boris / Jayden 访客分支补到的目标；它在 Viewer 中的实际显示情况仍不确定。 |


:::

::: {.dw-tab-panel #viewer-panel-jayden}

<div id="viewer-jayden"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Jayden：Tiger Day 状态]{#sprite-jayden-tiger-day} | 先进入 Tiger Day；酒馆后方的较早窗口不干预，把访客确定为 Jayden。随后同样需要选择色欲开门，并在 Jayden 自己的窗口选择色欲。更换访客的操作见[Boris / Jayden](../guide/choices.qmd#boris-jayden)。 |


:::

::: {.dw-tab-panel #viewer-panel-russel}

<div id="viewer-russel"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [Russel：营地状态]{#sprite-russel-camp} | Day of Reprieve 推进到营地段收尾时解锁。 |


:::

::: {.dw-tab-panel #viewer-panel-red-eyes-wolf}

<div id="viewer-red-eyes-wolf"></div>

| Viewer 目标 | 取得位置与操作 |
|---|---|
| [红眼狼：二次战状态]{#sprite-red-eyes-wolf-second-battle} | 完成市场后的 Gunther 二次战并进入随后共同遭遇时解锁；三种本源之轮操作都会到达这一共同段。剧情里看见不同战斗姿态，不会额外增加另一个 Viewer 目标。 |


:::

::::

一次 Tiger Day 流程只能邀请 Boris 或 Jayden 中的一人。想解锁另一人的 Viewer 状态，需要读取酒馆后方与 Boris 对峙前的存档，重新选择访客，再完成开门和邀请对方参与的操作。

Garret、Gunther 与红眼狼等角色在剧情里会出现多种动作、衣着或战斗表现；Viewer 按上表分组解锁，每次画面变化并不都另算一项。

<style>
.dw-lookup-tabs { margin-block: 1.2rem; }
.dw-tab-list { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .35rem; margin-bottom: .8rem; }
.dw-viewer-tabs > .dw-tab-list { grid-template-columns: repeat(5, minmax(0, 1fr)); }
.dw-tab-list button { min-width: 0; min-height: 2.8rem; padding: .55rem .35rem; border: 1px solid var(--dw-border); border-radius: .3rem; background: var(--dw-surface-soft); color: var(--dw-text-soft); font: inherit; cursor: pointer; }
.dw-tab-list button[aria-selected="true"] { background: var(--dw-primary-soft); color: var(--dw-heading); border-color: var(--dw-primary); font-weight: 650; }
.dw-tab-list button:hover, .dw-slot-grid a:hover { background: var(--dw-surface-hover); }
.dw-tab-list button:focus-visible, .dw-slot-grid a:focus-visible { outline: 2px solid var(--dw-primary); outline-offset: 2px; }
.dw-tab-panel[hidden] { display: none !important; }
.dw-slot-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: .55rem; margin-bottom: 1rem; }
.dw-slot-grid > * { min-width: 0; min-height: 4rem; display: flex; align-items: center; justify-content: center; padding: .6rem .35rem; border: 1px solid var(--dw-border); border-radius: .3rem; text-align: center; overflow-wrap: anywhere; background: var(--dw-surface); font-size: .92rem; }
.dw-slot-grid > .dw-slot-empty { color: var(--dw-text-faint); background: var(--dw-surface-soft); }
@media (max-width: 575px) {
  .dw-viewer-tabs > .dw-tab-list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .dw-slot-grid { gap: .35rem; }
}
</style>

<script>
(() => {
  const groups = [...document.querySelectorAll('.dw-lookup-tabs')];
  function select(group, id, focus = false) {
    group.querySelectorAll(':scope > .dw-tab-list > button').forEach(button => {
      const active = button.getAttribute('aria-controls') === id;
      button.setAttribute('aria-selected', String(active));
      button.tabIndex = active ? 0 : -1;
      if (active && focus) button.focus();
    });
    group.querySelectorAll(':scope > .dw-tab-panel').forEach(panel => panel.hidden = panel.id !== id);
  }
  groups.forEach(group => {
    const list = group.querySelector(':scope > .dw-tab-list');
    const buttons = [...list.querySelectorAll('button')];
    list.setAttribute('role', 'tablist');
    buttons.forEach((button, index) => {
      button.setAttribute('role', 'tab');
      const panel = document.getElementById(button.getAttribute('aria-controls'));
      panel.setAttribute('role', 'tabpanel');
      panel.setAttribute('aria-labelledby', button.id);
      button.addEventListener('click', () => select(group, panel.id));
      button.addEventListener('keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        if (event.key === 'ArrowLeft') next = (index - 1 + buttons.length) % buttons.length;
        if (event.key === 'Home') next = 0;
        if (event.key === 'End') next = buttons.length - 1;
        if (next === undefined) return;
        event.preventDefault();
        select(group, buttons[next].getAttribute('aria-controls'), true);
      });
    });
    select(group, buttons[0].getAttribute('aria-controls'));
  });
  function reveal(hash) {
    let target;
    try { target = document.getElementById(decodeURIComponent(hash.slice(1))); }
    catch { return; }
    if (!target) return;
    const panel = target.closest('.dw-tab-panel');
    if (panel) select(panel.closest('.dw-lookup-tabs'), panel.id);
    // Memorium conditions remain below the locator; keep its category in sync.
    const locator = document.querySelector('.dw-memory-tabs');
    const link = [...locator.querySelectorAll('.dw-slot-grid a')].find(a => new URL(a.href).hash === hash);
    if (link) select(locator, link.closest('.dw-tab-panel').id);
    if (!panel && !link) return false;
    // Tab visibility changes layout. Scroll once, after layout, to the whole row.
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const row = target.closest('tr') || target;
      const header = document.getElementById('quarto-header');
      const position = header && getComputedStyle(header).position;
      const inset = position === 'fixed' || position === 'sticky' ? header.getBoundingClientRect().height : 0;
      window.scrollTo({top: window.scrollY + row.getBoundingClientRect().top - inset - 16, behavior: 'instant'});
    }));
    return true;
  }
  document.addEventListener('click', event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target === '_blank') return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname !== location.pathname || !reveal(url.hash)) return;
    // Avoid competing native / Quarto smooth scrolling to a previously hidden target.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (location.hash !== url.hash) history.pushState(null, '', url.hash);
  }, true);
  window.addEventListener('hashchange', () => reveal(location.hash));
  window.addEventListener('load', () => reveal(location.hash));
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => reveal(location.hash));
  else reveal(location.hash);
})();
</script>
