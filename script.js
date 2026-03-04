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
    // 每次开始都强制重置，避免多次进入导致累计分数超过100
    currentQuestion = 0;
    totalScore = 0;
    scores = {obsession:0, anxiety:0, dependence:0, rational:0};

    document.querySelector('.result').style.display = 'none';
    document.getElementById('fullreport').style.display = 'none';
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

function selectOption(indexOrQuestion, optionIndex) {
    // 支持两种调用方式:
    // 1. selectOption(optionIndex) - UI按钮点击
    // 2. selectOption(questionIndex, optionIndex) - 自动化测试
    let questionIdx, optIdx;
    if (optionIndex === undefined) {
        // 方式1: 单参数,使用currentQuestion
        questionIdx = currentQuestion;
        optIdx = indexOrQuestion;
    } else {
        // 方式2: 双参数,显式指定题号和选项
        questionIdx = indexOrQuestion;
        optIdx = optionIndex;
    }
    
    const scoreValues = [3,2,1,0];
    const score = scoreValues[optIdx];
    
    // 根据题号分配到不同维度
    if(questionIdx<8) scores.obsession+=score;
    else if(questionIdx<14) scores.anxiety+=score;
    else if(questionIdx<19) scores.dependence+=score;
    else scores.rational+=score;
    
    totalScore+=score;
    
    // 只在UI模式下自动跳转下一题
    if (optionIndex === undefined) {
        if(currentQuestion<totalQuestions-1) {currentQuestion++; loadQuestion();} else {showResult();}
    }
}

function showResult() {
    document.querySelector('.question-section').style.display='none';
    document.querySelector('.result').style.display='block';
    const normalized = Math.max(0, Math.min(100, Math.round((totalScore/66)*100)));
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
    else analysis+='<p><strong>情绪稳定性:</strong> 情绪较为稳定,不易受关系波动影响。</p>';
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
        return `<div class="chart-row"><div class="chart-head"><span class="chart-label">${d.name}</span><span class="chart-value">${v}%</span></div><div class="chart-track"><div class="chart-fill ${d.cls}" style="width:${v}%"></div></div></div>`;
    }).join('');
    el.innerHTML = html;
}

function generateDeepAnalysis(score,type) {
    let reason='', risk='', advice='', psycho='';

    if(score>=65){
        reason = '<p>你的结果显示：在亲密关系里，你对“回应速度、语气变化、互动频率”非常敏感。只要出现一点不确定，你的注意力就会被迅速拉走，进入“反复确认—过度解释—情绪波动”的循环。</p>' +
                 '<p>这并不代表你不理性，而是你的关系安全系统长期处于高警觉。你会更容易把模糊信号解读成风险，因此在关系里投入很多心力去求稳，这也解释了你为什么会觉得“明明很努力，却还是很累”。</p>' +
                 '<p>从行为层看，你可能会出现：频繁查看消息、心里预演最坏结果、说话变得谨慎甚至讨好、把大量精力放在关系确认上。这些行为短期能缓解焦虑，长期却会增加内耗。</p>';

        risk = '<p><strong>短期风险：</strong>注意力被关系牵引，学习/工作效率下降，睡眠质量波动，情绪恢复速度变慢。</p>' +
               '<p><strong>中期风险：</strong>沟通结构变形——你真正想表达的是“需求”，说出口却常常变成“试探、解释或指责”，导致双方都觉得累。</p>' +
               '<p><strong>长期风险：</strong>自我价值感和关系稳定感绑定过深，容易形成“越焦虑越确认、越确认越焦虑”的循环。</p>';

        advice = '<div class="advice-item"><div class="advice-icon">①</div><div class="advice-text"><div class="advice-title">10分钟缓冲</div><div class="advice-desc">被触发后先暂停10分钟再回复，先稳情绪再处理关系，不在峰值状态下做决定。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">②</div><div class="advice-text"><div class="advice-title">事实/脑补分离卡</div><div class="advice-desc">写三行：发生了什么、我脑补了什么、还有哪些可能解释。每天做1次。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">③</div><div class="advice-text"><div class="advice-title">需求直说模板</div><div class="advice-desc">把“你为什么...”改成“我希望...”。例如：我希望我们吵架后能在24小时内复盘一次。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">④</div><div class="advice-text"><div class="advice-title">关系以外的稳定源</div><div class="advice-desc">每周固定安排运动/朋友/个人目标，避免把所有情绪稳定都押在一个人身上。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">⑤</div><div class="advice-text"><div class="advice-title">每周15分钟关系复盘</div><div class="advice-desc">复盘本周触发点、有效沟通、下周一个可执行改动，持续降低内耗。</div></div></div>';

        psycho = '<p>从依恋理论看，你更接近“高警觉互动模式”。重点不是压抑敏感，而是把敏感变成可管理的信息输入：先识别触发，再转换表达，再建立稳定节奏。</p>' +
                 '<p>你最需要的能力不是“完全不焦虑”，而是“焦虑出现时仍能保持选择权”。当你把自动反应改成有意识动作，关系质量会明显改善。</p>';

    } else if(score>=40){
        reason = '<p>你的状态属于“中度波动区”：会被关系触发，但还保留了拉回理性的能力。你不是持续失控，而是在特定场景（冷淡、延迟回复、冲突后沉默）更容易出现内耗。</p>' +
                 '<p>你的优势是有觉察，问题主要在于执行不稳定：知道该怎么做，但被触发时容易回到旧模式。这个区间非常适合做结构化微调，通常见效快。</p>' +
                 '<p>从互动上看，你可能在“表达需求”和“维持和气”之间反复摇摆，表面平稳，内里消耗。</p>';

        risk = '<p><strong>短期风险：</strong>关系中累积的小误解没有及时清理，压力在后期集中爆发。</p>' +
               '<p><strong>中期风险：</strong>边界模糊，容易在关键议题上让步过度，出现委屈但不表达。</p>' +
               '<p><strong>长期风险：</strong>把可修复的问题拖成结构性矛盾，降低关系满意度。</p>';

        advice = '<div class="advice-item"><div class="advice-icon">①</div><div class="advice-text"><div class="advice-title">每周一次触发复盘</div><div class="advice-desc">记录本周最强触发点、当时反应、替代动作，下周只改一个点。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">②</div><div class="advice-text"><div class="advice-title">边界清单</div><div class="advice-desc">写下“可让步/不可让步”各3条，沟通时按清单表达，减少临场摇摆。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">③</div><div class="advice-text"><div class="advice-title">低冲突表达</div><div class="advice-desc">用“事实-感受-请求”三步：先讲事实，再讲感受，最后给明确请求。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">④</div><div class="advice-text"><div class="advice-title">延迟确认训练</div><div class="advice-desc">把“立刻要回应”逐步拉长到30分钟，训练情绪自稳而非即时外部确认。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">⑤</div><div class="advice-text"><div class="advice-title">固定关系体检</div><div class="advice-desc">每月一次对齐彼此期待、节奏与边界，防止误解积压。</div></div></div>';

        psycho = '<p>你处在可塑性最强的区间。关键不是“大改”，而是持续做小改：把冲动反应改成可重复的流程动作。</p>' +
                 '<p>当你把复盘和边界建立成习惯，情绪波动会下降，关系稳定感会明显上升。</p>';

    } else {
        reason = '<p>你的结果显示整体稳定：你能在亲密关系中保持投入，也能保持自我边界，不容易因短期信号产生大幅波动。</p>' +
                 '<p>这是一种高质量基础状态。你通常能够把关系问题放回现实语境里处理，而不是完全被情绪牵着走。</p>' +
                 '<p>你的下一步重点不是“更稳定”，而是“更有温度地稳定”：在稳定基础上提升表达、共情与连接质量。</p>';

        risk = '<p><strong>潜在风险：</strong>低波动并不等于没有风险。若过度理性、表达偏少，关系可能出现“有秩序但不亲密”的体验。</p>' +
               '<p><strong>常见盲点：</strong>默认对方“应该懂”，导致需求表达不足，长期会降低亲密感。</p>';

        advice = '<div class="advice-item"><div class="advice-icon">①</div><div class="advice-text"><div class="advice-title">保持稳定节奏</div><div class="advice-desc">继续维持个人生活结构，关系与自我并行，不互相吞没。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">②</div><div class="advice-text"><div class="advice-title">增加正向表达频率</div><div class="advice-desc">每周至少2次明确表达感谢、欣赏与需求，提升关系温度。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">③</div><div class="advice-text"><div class="advice-title">冲突后24小时复盘</div><div class="advice-desc">就事论事，复盘事实、感受、改进动作，不做人格归因。</div></div></div>' +
                 '<div class="advice-item"><div class="advice-icon">④</div><div class="advice-text"><div class="advice-title">双向边界更新</div><div class="advice-desc">每月更新一次边界与期待，确保双方都被看见。</div></div></div>';

        psycho = '<p>从心理机制上看，你更接近安全型互动。你的优势是稳定与清晰，建议继续在“表达质量”和“情感连接”上精进。</p>' +
                 '<p>稳定不是终点，而是更高质量亲密关系的起点。</p>';
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

