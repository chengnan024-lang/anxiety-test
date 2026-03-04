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
        reason='<strong>你在经历什么：</strong><p>你真的很在乎这段关系。对方的一条消息，一个语气变化，就能让你想很多。你不是故意要找麻烦，而是你的大脑天生对"关系不确定"这件事特别敏感。</p><p>别人可能发完消息就去刷剧了，你不行。你会反复看聊天记录，会预演最坏的结果，会在凌晨三点还睁着眼睛想"他到底怎么想的"。</p><p>这真的很累。但我想告诉你：这不是你的错，也不是因为你"不够好"。你对关系投入得越多，大脑就越会把"失去"这件事放大。这是一种自我保护机制，只是有时候保护过度了。</p>';
        risk='<strong>可能会遇到的问题：</strong><p>1. <b>情绪过山车：</b>对方一个"嗯"就能让你心情跌到谷底，一个"想你"又能瞬间升到天花板，这种大起大落会让身边的人也很累。</p><p>2. <b>忍不住试探：</b>你会用各种方式去"确认"对方还爱你——反复问"你真的爱我吗"、查岗、故意冷淡看对方反应。短期能让你安心，但长期会消耗双方。</p><p>3. <b>失去自己：</b>谈着谈着，你会发现自己的生活、朋友、兴趣都在为这段关系让路。有一天你突然想问：这是我想要的关系，还是只是害怕失去？</p><p>4. <b>身体报警：</b>长期焦虑真的会体现在身体上——失眠、胃疼、心慌、胸闷。你可能觉得是"想太多"，其实身体已经在报警了。</p>';
        advice='<strong>你可以试试这样做：</strong><p><b>① 先停下来，给自己10分钟</b><br>下次你想立刻发消息问清楚的时候，先把手机放下。去喝杯水、刷个牙、换个衣服。10分钟后如果还想发，再发。这10分钟是给你情绪一个缓冲，不是压抑，而是别在冲动的时候做决定。</p><p><b>② 把你担心的"事实"和"猜测"分开写</b><br>拿张纸，左边写"刚才发生了什么"，右边写"我于是想到了..."。写着写着你会发现：很多担心是脑补出来的，不是事实。</p><p><b>③ 直接说需求，别让对方猜</b><br>"你为什么都不回我消息！" → "你刚才很久没回我，我有点慌，我需要知道你在干嘛。"后者听起来没那么大火，但对方真的知道怎么安慰你了。</p><p><b>④ 给自己留一点"关系以外的时间"</b><br>每周至少半天完全不想他，去做点自己的事。运动、见朋友、看剧都行。你不是非要24小时都围着这段关系转。</p><p><b>⑤ 实在不行，写下来</b><br>很多话当面说不出口，就写在本子上。写完了烧掉也行。总之别憋在心里，也别一次性全部倾倒给对方。</p>';
        psycho='<strong>这到底是怎么回事：</strong><p>从心理学上说，你属于"焦虑型依恋"。这不是病，而是你形成的一种自我保护模式——因为过去有过"关系可能随时失去"的经历，所以你的大脑特别警觉。</p><p>但我想告诉你一句话：<b>敏感不是缺点，它是天赋。</b>你对关系有很深的感知力，你懂得珍惜，你愿意投入。只是有时候需要学习一下，怎么和这份敏感相处，而不是被它控制。</p><p>你不需要"变得更成熟"或者"想开一点"。你需要的只是一个方法，让你的在乎，变成关系的加分项，而不是彼此的消耗。</p>';
    } else if(score>=40) {
        reason='<strong>你在经历什么：</strong><p>你谈恋爱的时候，状态会有起伏。有时候觉得"哇他好可爱"，有时候又会有点不安："他是不是没那么在乎我了？"</p><p>你不是那种会天天查岗的人，但对方如果突然冷淡了一点，你会忍不住想"是不是我说错什么了"。你知道自己是敏感的那一方，但整体还能控制。</p><p>你偶尔也会羡慕那些"谈得很轻松"的人——为什么他们可以那么笃定，而你总是会有点担心？</p>';
        risk='<strong>可能会遇到的问题：</strong><p>1. <b>不说憋着，说了怕吵架</b><br>你有不满的时候会犹豫：说了怕破坏气氛，不说自己又憋得难受。时间久了可能会积累成怨气，然后在一个很小的点上突然爆发。</p><p>2. <b>容易自我怀疑</b><br>对方一个眼神不对，你就会想"我是不是做错了什么"。这种自我怀疑会让人活得很小心，很累。</p><p>3. <b>在"再试试"和"算了吧"之间来回拉扯</b><br>有时候觉得还能抢救一下，有时候又觉得"算了就这样吧"。这种摇摆会让你很疲惫。</p>';
        advice='<strong>你可以试试这样做：</strong><p><b>① 每周找一件小事，直接说</b><br>不需要什么大事，就是"今天那个事情让我有点不舒服"——练的就是直接说的习惯。说完了你会发现，其实没那么可怕。</p><p><b>② 给自己一个"观察期"</b><br>下次感到不安的时候，别急着下结论。记录下来：什么时候、因为什么、当时怎么想的。一周之后回头看，你会发现很多担心其实没发生。</p><p><b>③ 列出你的"不可让步"和"可以让步"</b><br>有些事情你真的很在意（比如说一定要有回应），有些事情其实可以放过去。把这个想清楚了，沟通的时候就有底了。</p><p><b>④ 找一个除了恋爱以外的精神支点</b><br>不管是工作、爱好还是朋友。当你的快乐不只来源于恋爱的时候，这段关系反而会更健康。</p>';
        psycho='<strong>这到底是怎么回事：</strong><p>你属于"焦虑型和安全型之间"——你有安全型的底子，但偶尔会滑向焦虑那一边。这其实是一个可以塑造的区间。</p><p>你最大的优势是：有觉察。你知道自己有时候会过度反应，你愿意反思。这比那些完全不自知的人好太多了。</p><p>你需要练习的只是一个东西：<b>在情绪和反应之间，给理性留一点空间。</b>不需要完全消除焦虑，只需要让它不要每次都直接变成行动。</p>';
    } else {
        reason='<strong>你在经历什么：</strong><p>你谈恋爱的方式蛮成熟的。不会一天到晚粘着对方，也不会患得患失。你有自己的生活，有自己的圈子，恋爱只是你生活的一部分，不是全部。</p><p>你懂得在关系中保持独立，也懂得在需要的时候给到对方支持。这种状态其实很难得，是很多人想要但达不到的。</p><p>但有时候你会觉得：是不是自己太"理智"了？好像没有那么轰轰烈烈，会不会其实没那么爱？</p>';
        risk='<strong>可能会遇到的问题：</strong><p>1. <b>过于理性，缺少表达</b><br>你心里可能有很多感受，但不太习惯说出来。对方可能会觉得你"不在乎"或者"不够热情"。</p><p>2. <b>把"不吵"当成"没问题"</b><br>有时候你觉得"我们从来不吵架"是好事，但如果一直是一方在忍让，那这个"不吵"可能只是表面和平。</p><p>3. <b>忽略自己的需求</b><br>你总是迁就、总是OK、总是"我都行"。但不说出来，对方怎么知道你也有想要什么呢？</p>';
        advice='<strong>你可以试试这样做：</strong><p><b>① 偶尔也说说"我很在乎你"</b><br>不需要每天肉麻，但定期表达一下，对方会安心很多。你不说，对方真的会猜。</p><p><b>② 允许自己也有"不OK"的时候</b><br>不是每件事都要让着，你也可以说"这个我不太舒服"。表达需求不等于作，也不等于不懂事。</p><p><b>③ 每个月约一次"关系复盘"</b><br>不是吵架，就是聊聊：最近感觉怎么样？有什么想调整的？有什么我做得不好的？定期对话比出了问题再谈更健康。</p>';
        psycho='<strong>这到底是怎么回事：</strong><p>你属于"安全型依恋"。这是最健康的依恋模式——你能享受亲密，也能保持独立；你能付出，也能保护自己。</p><p>你的课题不是"如何更投入"，而是"如何在保持独立的同时，让关系更有温度"。你已经做得很好了，只需要偶尔提醒自己：爱是需要表达的，不说出口的在乎，对方可能真的感受不到。</p>';
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
