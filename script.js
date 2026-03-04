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
        reason='<strong>核心表现：</strong><p>你在关系里会更容易被互动细节触发，确认行为偏高，情绪恢复速度依赖对方回应。</p>';
        risk='<strong>风险提醒：</strong><p>容易出现时间失焦、情绪内耗、沟通失真（明明想表达需求，最后变成试探或讨好）。</p>';
        advice='<strong>调整建议：</strong><p>先做“延迟回应 + 事实记录”双动作：先停10分钟，再把事实和脑补分开写，最后再发消息。</p>';
        psycho='<strong>心理机制：</strong><p>高警觉模式会放大不确定性。你需要的不是压抑情绪，而是建立更稳定的内部确认系统。</p>';
    } else if(score>=40) {
        reason='<strong>核心表现：</strong><p>你有一定情绪波动，但仍保留边界感。触发时会不安，但多数情况下能拉回理性。</p>';
        risk='<strong>风险提醒：</strong><p>若长期不表达真实需求，关系会进入“表面平稳、内里消耗”的状态。</p>';
        advice='<strong>调整建议：</strong><p>每周做一次关系复盘：本周触发点、真实需求、下周一个可执行动作。</p>';
        psycho='<strong>心理机制：</strong><p>你处在可优化区间，关键是把“自动反应”改成“有意识选择”。</p>';
    } else {
        reason='<strong>核心表现：</strong><p>你整体较稳定，能兼顾投入与边界，不容易被短期波动牵走。</p>';
        risk='<strong>风险提醒：</strong><p>注意别把稳定变成压抑，保持真实表达，关系会更有质量。</p>';
        advice='<strong>调整建议：</strong><p>继续维持节奏，并定期做低冲突沟通（事实-感受-请求）来增强亲密质量。</p>';
        psycho='<strong>心理机制：</strong><p>你更接近安全型互动方式，核心任务是稳定输出而非过度控制。</p>';
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
