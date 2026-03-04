const questions = [
    "我会因为对方回复慢而反复看手机。",
    "我会因为对方语气变冷而怀疑关系出了问题。",
    "我会因为一句模糊回复而反复猜测对方真实想法。",
    "我会因为一次小冲突就预演最坏结果。",
    "我会因为对方临时取消见面而明显焦虑。",
    "我会因为对方状态变化而整天心神不宁。",
    "我会因为想确认被爱而反复向对方要回应。",
    "我会因为不安而频繁查看对方社交动态。",
    "我会因为想安心而关注对方在线状态或定位。",
    "我会因为对方一句安抚而情绪立刻好转。",
    "我会因为没有及时得到回应而坐立不安。",
    "我会因为害怕失去而很难停止联系对方。",
    "我会因为怕对方不开心而压住真实想法。",
    "我会因为想维持关系而降低自己的需求。",
    "我会因为迎合对方而改变原本的生活习惯。",
    "我会因为关系紧张而优先讨好而不是表达。",
    "我会因为担心冲突而回避重要沟通。",
    "我会因为关系问题而难以专注学习或工作。",
    "我会因为关系波动而影响睡眠。",
    "我会因为情绪反复而影响吃饭或作息。",
    "我会因为关系内耗而减少和朋友家人的联系。",
    "我会因为反复想关系问题而影响当天效率。"
];

const options = [
    ["每小时都在想", "每天几次", "偶尔", "从不"],
    ["每天数次", "每天一次", "偶尔", "从不"],
    ["经常难以专注", "偶尔分心", "基本不影响", "完全不影响"],
    ["经常压抑", "偶尔妥协", "基本表达", "完全真实"],
    ["总是这样想", "经常", "偶尔", "从不"],
    ["超过1小时", "30分钟左右", "几分钟", "不会"],
    ["总是", "经常", "偶尔", "从不"],
    ["经常出现", "偶尔", "很少", "从不"],
    ["经常忽略", "偶尔", "基本兼顾", "完全不影响"],
    ["很多方面", "某些方面", "极少", "从不"],
    ["完全是", "经常", "偶尔", "不会"],
    ["经常", "偶尔", "很少", "从不"],
    ["非常强烈", "明显", "轻微", "不会"],
    ["经常", "偶尔", "很少", "从不"],
    ["经常", "偶尔", "很少", "从不"],
    ["立即", "很快", "需要时间", "不会"],
    ["总是", "经常", "偶尔", "从不"],
    ["经常", "偶尔", "很少", "从不"],
    ["经常", "偶尔", "很少", "从不"],
    ["3小时以上", "1-3小时", "30分钟内", "不刷"],
    ["总是", "经常", "偶尔", "从不"],
    ["经常", "偶尔", "很少", "从不"]
];

let currentQuestion = 0;
let scores = {obsession:0, anxiety:0, dependence:0, rational:0};
let totalScore = 0;
const totalQuestions = 22;

function start(version) {
    document.querySelector('.home').style.display = 'none';
    document.querySelector('.question-section').style.display = 'block';
    if(version==='deep') document.getElementById('deep-indicator').style.display='block';
    loadQuestion();
}

function loadQuestion() {
    document.getElementById('question').textContent = questions[currentQuestion];
    document.getElementById('progress-text').textContent = `${currentQuestion+1}/${totalQuestions}`;
    document.getElementById('progress-bar').style.width = `${(currentQuestion+1)/totalQuestions*100}%`;
    const optionsDiv = document.getElementById('options');
    optionsDiv.innerHTML = '';
    options[currentQuestion].forEach((option, index) => {
        const btn = document.createElement('button');
        btn.className = 'option-btn';
        btn.textContent = option;
        btn.onclick = () => selectOption(index);
        optionsDiv.appendChild(btn);
    });
}

function selectOption(index) {
    const scoreValues = [3,2,1,0];
    const score = scoreValues[index];
    if(currentQuestion<8) scores.obsession+=score;
    else if(currentQuestion<14) scores.anxiety+=score;
    else if(currentQuestion<19) scores.dependence+=score;
    else scores.rational+=score;
    totalScore+=score;
    if(currentQuestion<totalQuestions-1) {currentQuestion++; loadQuestion();} else {showResult();}
}

function showResult() {
    document.querySelector('.question-section').style.display='none';
    document.querySelector('.result').style.display='block';
    const normalized = Math.round((totalScore/66)*100);
    const level = getLevelByScore(normalized);
    const type = brainLevels[level];
    document.getElementById('scoreNum').textContent = normalized;
    document.getElementById('typeName').textContent = type.name;
    document.getElementById('typeEmoji').textContent = type.emoji;
    document.getElementById('typeDesc').textContent = type.desc;
    let analysis = '';
    if(scores.obsession>=15) analysis+='<p><strong>投入强度:</strong> 关系中表现出较高的关注度和投入频率。</p>';
    else if(scores.obsession>=8) analysis+='<p><strong>投入强度:</strong> 关系中有一定的关注和投入，处于中等水平。</p>';
    else analysis+='<p><strong>投入强度:</strong> 关系中能保持适度的关注，不过度投入。</p>';
    if(scores.anxiety>=12) analysis+='<p><strong>情绪稳定性:</strong> 容易因关系波动而产生情绪起伏。</p>';
    else if(scores.anxiety>=6) analysis+='<p><strong>情绪稳定性:</strong> 偶尔会因关系问题而情绪波动。</p>';
    else analysis+='<p><strong>情绪稳定性:</strong> 情绪较为稳定，不易受关系波动影响。</p>';
    if(scores.dependence>=10) analysis+='<p><strong>自主性:</strong> 在关系中可能会降低自我需求来维持和谐。</p>';
    else if(scores.dependence>=5) analysis+='<p><strong>自主性:</strong> 在关系中偶尔会妥协自己的需求。</p>';
    else analysis+='<p><strong>自主性:</strong> 在关系中能较好地保持自我和边界。</p>';
    if(scores.rational>=6) analysis+='<p><strong>理性程度:</strong> 关系对日常生活的影响相对较小。</p>';
    else analysis+='<p><strong>理性程度:</strong> 能在关系中保持理性和生活平衡。</p>';
    document.getElementById('mainAnalysis').innerHTML=analysis;
    renderDimensionChart('miniChart');
    if(totalQuestions>=22) document.getElementById('locked-section').classList.add('show');
}

function getLevelByScore(score) {
    if(score>=65) return 'high';
    if(score>=40) return 'medium';
    return 'low';
}

const brainLevels = {
    high: {name:'高敏依赖型', emoji:'🚨', desc:'在亲密关系中表现出较高频次的情绪波动与确认性行为。', color:'#FF6B6B'},
    medium: {name:'中度波动型', emoji:'💞', desc:'在亲密关系中有中等频次的情绪反应与确认行为。', color:'#FFB74D'},
    low: {name:'边界稳定型', emoji:'🌿', desc:'在亲密关系中能兼顾投入与边界，情绪相对稳定。', color:'#81C784'}
};

function renderDimensionChart(targetId){
    const el = document.getElementById(targetId);
    if(!el) return;
    const dims = [
        {name:'关系警觉', key:'obsession', max:24, cls:'c1'},
        {name:'依赖确认', key:'anxiety', max:18, cls:'c2'},
        {name:'边界弹性', key:'dependence', max:15, cls:'c3'},
        {name:'功能受损', key:'rational', max:9, cls:'c4'}
    ];
    const html = dims.map(d=>{
        const v = Math.round((scores[d.key]/d.max)*100);
        return `<div class="chart-row"><div class="chart-head"><span>${d.name}</span><span>${v}%</span></div><div class="chart-track"><div class="chart-fill ${d.cls}" style="width:${v}%"></div></div></div>`;
    }).join('');
    el.innerHTML = html;
}

function generateDeepAnalysis(score,type) {
    let reason='', risk='', advice='', psycho='';
    if(score>=65) {
        reason='<strong>核心表现：</strong><p>你在亲密关系里对不确定信号非常敏感，互动中的细微变化（回复速度、语气转变、沟通频率）都会被你迅速感知并放大。你并不是不讲道理，而是关系安全系统长期处于高警觉状态，这会让你在“确认关系是否稳定”上投入大量精力。</p><p>这种状态下，你容易出现反复确认、过度解读、情绪拉扯和持续反刍。短期看，这些动作能降低焦虑；长期看，会提升内耗，形成“越确认越不安”的循环。</p>';
        risk='<strong>风险提醒：</strong><p><b>短期：</b>注意力被关系牵引，学习/工作效率下降，睡眠质量波动，情绪恢复速度变慢。</p><p><b>中期：</b>沟通结构容易失真——你真正想表达“需求”，最后可能变成“试探、解释或指责”，双方都累。</p><p><b>长期：</b>自我价值感与关系稳定感绑定过深，一旦关系波动，就会引发明显自我否定。</p>';
        advice='<div class="advice-item"><div class="advice-icon">①</div><div class="advice-text"><div class="advice-title">10分钟缓冲规则</div><div class="advice-desc">触发后先暂停10分钟再回复，避免在情绪峰值做关系决策。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">②</div><div class="advice-text"><div class="advice-title">事实-脑补分离</div><div class="advice-desc">写下“事实发生了什么 / 我脑补了什么 / 还有哪些可能解释”。每天1次，连续7天。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">③</div><div class="advice-text"><div class="advice-title">需求直说模板</div><div class="advice-desc">把“你为什么...”改成“我希望...”。把隐性期待改成可执行请求。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">④</div><div class="advice-text"><div class="advice-title">建立关系外稳定源</div><div class="advice-desc">每周固定安排运动、社交、个人目标，减少单一情绪依赖。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">⑤</div><div class="advice-text"><div class="advice-title">每周15分钟复盘</div><div class="advice-desc">复盘触发点、有效沟通与下周一个改动，持续降低内耗。</div></div></div>';
        psycho='<strong>心理机制说明：</strong><p>从依恋理论看，这更接近“高警觉互动模式”。重点不是压抑敏感，而是把敏感转化为可管理信息：先识别触发，再转换表达，再建立稳定节奏。</p><p>你的关键能力不是“完全不焦虑”，而是“焦虑出现时仍保有选择权”。当自动反应被流程化替代，关系质量会明显提升。</p>';
    } else if(score>=40) {
        reason='<strong>核心表现：</strong><p>你处在“中度波动区”：会被关系触发，但整体仍有拉回理性的能力。你并非持续失控，而是在特定场景（冷淡、延迟回复、冲突后沉默）更容易内耗。</p><p>你的优势是有觉察，问题主要在执行稳定性——知道该做什么，但触发时容易回到旧模式。</p>';
        risk='<strong>风险提醒：</strong><p><b>短期：</b>小误解若不及时清理，容易反复积压。</p><p><b>中期：</b>边界模糊，关键议题上让步过度，出现委屈但不表达。</p><p><b>长期：</b>可修复问题被拖成结构性矛盾，关系满意度下降。</p>';
        advice='<div class="advice-item"><div class="advice-icon">①</div><div class="advice-text"><div class="advice-title">每周触发复盘</div><div class="advice-desc">记录本周最强触发点、当时反应、替代动作，下周只改一个点。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">②</div><div class="advice-text"><div class="advice-title">边界清单</div><div class="advice-desc">列出“可让步/不可让步”各3条，沟通按清单说，减少临场摇摆。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">③</div><div class="advice-text"><div class="advice-title">低冲突表达</div><div class="advice-desc">使用“事实-感受-请求”三步，降低误解与防御。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">④</div><div class="advice-text"><div class="advice-title">延迟确认训练</div><div class="advice-desc">将“立刻要回应”逐步拉长到30分钟，训练自稳能力。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">⑤</div><div class="advice-text"><div class="advice-title">月度关系体检</div><div class="advice-desc">每月一次对齐期待、节奏和边界，防止问题累积。</div></div></div>';
        psycho='<strong>心理机制说明：</strong><p>你在可塑性最强区间，最有效的路径不是大改，而是持续小改。把冲动反应替换为可重复动作，波动会明显下降。</p>';
    } else {
        reason='<strong>核心表现：</strong><p>你整体较稳定，能在投入关系同时保持边界，不容易被短期波动牵走。这是高质量关系的良好基础。</p><p>你的重点不在“更稳定”，而在“更有温度的稳定”：提升表达质量与连接深度。</p>';
        risk='<strong>风险提醒：</strong><p><b>潜在风险：</b>过度理性或表达偏少，会出现“有秩序但不亲密”。</p><p><b>常见盲点：</b>默认对方“应该懂”，导致需求表达不足。</p>';
        advice='<div class="advice-item"><div class="advice-icon">①</div><div class="advice-text"><div class="advice-title">维持稳定节奏</div><div class="advice-desc">继续保持作息、社交和个人计划，不把关系作为唯一情绪来源。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">②</div><div class="advice-text"><div class="advice-title">提高正向表达频率</div><div class="advice-desc">每周至少2次明确表达感谢、欣赏与需求。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">③</div><div class="advice-text"><div class="advice-title">冲突后24小时复盘</div><div class="advice-desc">复盘事实、感受、改进动作，不做人身归因。</div></div></div>' +
               '<div class="advice-item"><div class="advice-icon">④</div><div class="advice-text"><div class="advice-title">边界双向更新</div><div class="advice-desc">每月更新边界与期待，确保双方都被看见。</div></div></div>';
        psycho='<strong>心理机制说明：</strong><p>你更接近安全型互动。继续稳定输出并增加高质量沟通，关系会在“稳”的基础上更“近”。</p>';
    }
    return {reason,risk,advice,psycho};
}

function paySuccess() {
    document.querySelector('.result').style.display='none';
    document.getElementById('fullreport').style.display='block';
    const score = parseInt(document.getElementById('scoreNum').textContent);
    const level = getLevelByScore(score);
    const type = brainLevels[level];
    const analysis = generateDeepAnalysis(score,type);
    document.getElementById('typeName2').textContent = type.name;
    document.getElementById('scoreNum2').textContent = score;
    document.getElementById('reasonAnalysis').innerHTML = analysis.reason;
    document.getElementById('riskAnalysis').innerHTML = analysis.risk;
    document.getElementById('adviceAnalysis').innerHTML = analysis.advice;
    document.getElementById('psychoContent').innerHTML = analysis.psycho;
    renderDimensionChart('fullChart');
}

function restart() {
    currentQuestion=0;
    scores={obsession:0,anxiety:0,dependence:0,rational:0};
    totalScore=0;
    document.querySelector('.result').style.display='none';
    document.getElementById('fullreport').style.display='none';
    document.querySelector('.home').style.display='block';
    document.getElementById('locked-section').classList.remove('show');
}

