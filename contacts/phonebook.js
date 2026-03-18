const contactData = [
    // --- 長官室 ---
    { "dept": "長官室", "name": "主任室", "title": "主任", "ext": "2172" },
    { "dept": "長官室", "name": "專員室", "title": "專員", "ext": "2173" },

    // --- 第一股 ---
    { "dept": "第一股", "name": "蕭宇廷", "title": "股長", "ext": "2390" },
    { "dept": "第一股", "name": "林朝國", "title": "組員", "ext": "2391" },
    { "dept": "第一股", "name": "徐嘉駿", "title": "組員", "ext": "2394" },
    { "dept": "第一股", "name": "吳珮宸", "title": "組員", "ext": "2395" },
    { "dept": "第一股", "name": "陳伯耕", "title": "組員", "ext": "2396" },
    { "dept": "第一股", "name": "董譯澤", "title": "組員", "ext": "2397" },
    { "dept": "第一股", "name": "茆璨鵬", "title": "組員", "ext": "2398" },
    { "dept": "第一股", "name": "楊智宇", "title": "組員", "ext": "2399" },

    // --- 第二股 ---
    { "dept": "第二股", "name": "魏世政", "title": "股長", "ext": "2409" },
    { "dept": "第二股", "name": "吳冠宇", "title": "組員", "ext": "2410" },
    { "dept": "第二股", "name": "林昱至", "title": "組員", "ext": "2411" },
    { "dept": "第二股", "name": "楊惠瑜", "title": "組員", "ext": "2412" },
    { "dept": "第二股", "name": "彭樹庭", "title": "組員", "ext": "2414" },
    { "dept": "第二股", "name": "江冠遠", "title": "組員", "ext": "2415" },
    { "dept": "第二股", "name": "乃卓康", "title": "組員", "ext": "2416" },
    { "dept": "第二股", "name": "羅雅秀", "title": "組員", "ext": "2417" },

    // --- 第三股 ---
    { "dept": "第三股", "name": "徐荷惠", "title": "股長", "ext": "2418" },
    { "dept": "第三股", "name": "蔡宗穎", "title": "組員", "ext": "2419" },
    { "dept": "第三股", "name": "蔡雅樺", "title": "組員", "ext": "2420" },
    { "dept": "第三股", "name": "林宜臻", "title": "組員", "ext": "2421" },
    { "dept": "第三股", "name": "余秀娟", "title": "組員", "ext": "2422" },
    { "dept": "第三股", "name": "謝雨致", "title": "組員", "ext": "2423" },
    { "dept": "第三股", "name": "陳輝航", "title": "組員", "ext": "2424" },
    { "dept": "第三股", "name": "柏明儀", "title": "組員", "ext": "2426" },

    // --- DNA小組 ---
    { "dept": "DNA小組", "name": "翁菁蓮", "title": "警務正", "ext": "2400" },
    { "dept": "DNA小組", "name": "王喬立", "title": "組員", "ext": "2401" },
    { "dept": "DNA小組", "name": "陳昭安", "title": "組員", "ext": "2402" },
    { "dept": "DNA小組", "name": "莊偉仁", "title": "組員", "ext": "2404" },
    { "dept": "DNA小組", "name": "李佳龍", "title": "組員", "ext": "2405" },
    { "dept": "DNA小組", "name": "林瑜敏", "title": "組員", "ext": "2406" },
    { "dept": "DNA小組", "name": "花霈誼", "title": "組員", "ext": "2407" },

    // --- 辦公室區域 ---
    { "dept": "辦公室區域", "name": "會議室", "title": "8樓", "ext": "2428" },
    { "dept": "辦公室區域", "name": "會客室", "title": "8樓", "ext": "2427" },
    { "dept": "辦公室區域", "name": "證物室", "title": "8樓", "ext": "2689" },
    { "dept": "辦公室區域", "name": "槍彈室", "title": "8樓", "ext": "2690" },
    { "dept": "辦公室區域", "name": "指紋室", "title": "8樓", "ext": "2687" },

    // --- 8樓實驗室 ---
    { "dept": "8樓實驗室", "name": "痕跡實驗室", "title": "Lab", "ext": "2683" },
    { "dept": "8樓實驗室", "name": "槍彈實驗室", "title": "Lab", "ext": "2690" },
    { "dept": "8樓實驗室", "name": "證物室", "title": "Lab", "ext": "2689" },
    { "dept": "8樓實驗室", "name": "指紋實驗室", "title": "Lab", "ext": "2688" },
    { "dept": "8樓實驗室", "name": "指紋工作站", "title": "Lab", "ext": "2687" },
    { "dept": "8樓實驗室", "name": "化學實驗室", "title": "Lab", "ext": "2685" },
    { "dept": "8樓實驗室", "name": "重建教室", "title": "Lab", "ext": "2684" },
    { "dept": "8樓實驗室", "name": "出勤區", "title": "Area", "ext": "2682" },
    { "dept": "8樓實驗室", "name": "會議室", "title": "Lab Area", "ext": "2679" },
    { "dept": "8樓實驗室", "name": "電泳室", "title": "Lab", "ext": "2678" },
    { "dept": "8樓實驗室", "name": "萃取室", "title": "Lab", "ext": "2676" },
    { "dept": "8樓實驗室", "name": "前處理室", "title": "Lab", "ext": "2675" },
    { "dept": "8樓實驗室", "name": "標準室", "title": "Lab", "ext": "2674" },
    { "dept": "8樓實驗室", "name": "DNA收案", "title": "Lab", "ext": "2673" },

    // --- 刑事警察局 ---
    { "dept": "刑事警察局", "name": "生物科", "title": "CIB", "ext": "725-2502~5" },
    { "dept": "刑事警察局", "name": "指紋科", "title": "CIB", "ext": "725-3124~6" },
    { "dept": "刑事警察局", "name": "槍彈股", "title": "CIB", "ext": "725-2477~8" },
    { "dept": "刑事警察局", "name": "化學股", "title": "CIB", "ext": "725-2471~2" },
    { "dept": "刑事警察局", "name": "偵五隊", "title": "CIB", "ext": "791-4020~21" }
];

function showGroup(groupName) {
    const menu = document.getElementById('group-menu');
    const listView = document.getElementById('contact-list-view');
    const container = document.getElementById('contacts-container');
    const title = document.getElementById('selected-group-name');

    menu.classList.add('hidden');
    listView.classList.remove('hidden');
    title.innerText = groupName;

    container.innerHTML = '';
    const filtered = contactData.filter(c => c.dept === groupName);

    filtered.forEach(c => {
        const card = document.createElement('div');
        card.className = 'contact-card';
        card.innerHTML = `
            <div class="info">
                <span class="name">${c.name}</span>
                <span class="title">${c.title}</span>
            </div>
            <div class="ext-box">📞 ${c.ext}</div>
        `;
        container.appendChild(card);
    });
}

function goBack() {
    document.getElementById('group-menu').classList.remove('hidden');
    document.getElementById('contact-list-view').classList.add('hidden');
}