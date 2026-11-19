(() => {
    const shell = document.querySelector('.game-shell');
    const canvas = document.querySelector('#career-game');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Use a linha do tempo do portfólio como fonte dos marcos do jogo.
    const jobs = [...document.querySelectorAll('.timeline .job')].reverse();
    const milestones = jobs.flatMap(job => {
        const company = job.querySelector('h3').textContent;
        const role = job.querySelector('.role').textContent;
        const description = [...job.querySelectorAll('p:not(.role)')]
            .map(paragraph => paragraph.textContent).join(' ');
        const contracts = [...job.querySelectorAll('.contracts li')].reverse();
        return contracts.length ? contracts.map(contract => ({
            name: contract.querySelector('strong').textContent,
            role: 'Desenvolvedor Full Stack · ' + contract.querySelector('span').textContent,
            description: company + '. ' + description
        })) : [{ name: company, role, description }];
    });
    const dialogueByCompany = new Map([
        ['RSI', ['🧪', 'Na RSI, comecei em qualidade de software, criando scripts de automação e executando testes.']],
        ['Stefanini', ['📬', 'Na Stefanini, trabalhei em sistemas dos Correios e desenvolvi aplicações com Java e React.']],
        ['CTIS', ['💳', 'Na CTIS, ajudei a manter e evoluir sistemas de crédito do Sicoob.']],
        ['BASIS', ['🎓', 'Na BASIS, trabalhei no Censo da Educação Básica e no Revalida para o Inep.']],
        ['TTY2000', ['🏦', 'Na TTY2000, entrei nos projetos SITMA, SIPRG e SICOD da Caixa.']],
        ['Resource Tecnologia', ['🛠️', 'Na Resource Tecnologia, desenvolvi funcionalidades do SITMA com Java e Angular.']],
        ['POUPEX', ['🧩', 'Na POUPEX, desenvolvi microsserviços e dei manutenção em aplicações Java legadas.']],
        ['Qintess', ['🤝', 'Na Qintess, dei continuidade ao desenvolvimento e à sustentação dos sistemas da Caixa.']],
        ['Spread Tecnologia', ['💻', 'Na Spread Tecnologia, segui trabalhando no front-end e no back-end dos sistemas da Caixa.']],
        ['DigSystem', ['🏁', 'Chegamos à DigSystem, minha etapa atual de desenvolvimento full stack para a Caixa!']]
    ]);
    const platforms = Array.from({ length: milestones.length + 1 }, (_, index) => ({
        x: 28 + index * 162,
        y: 308 - index * 23,
        width: 126
    }));
    const stageHeight = 360;
    const player = { x: 0, y: 0, vy: 0, facing: 1, step: 0, grounded: true };
    const visited = new Set();
    const keys = new Set();
    const pointers = new Map();
    const progress = shell.querySelector('#game-progress');
    const progressBar = shell.querySelector('progress');
    const dialogue = shell.querySelector('.game-dialogue');
    const dialogueIcon = dialogue.querySelector('.game-dialogue-icon');
    const dialogueText = dialogue.querySelector('p');
    const story = shell.querySelector('.game-story');
    const start = shell.querySelector('.game-start');
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
    let current = -1;
    let checkpoint = 0;
    let viewport = 900;
    let running = false;
    let frame = 0;
    let previous = 0;
    let jumpRequested = false;

    function speak(icon, text) {
        dialogueIcon.textContent = icon;
        dialogueText.textContent = text;
    }

    function showMilestone(index) {
        if (current === index) return;
        current = index;
        const milestone = milestones[index - 1];
        speak(...(dialogueByCompany.get(milestone?.name) ?? (milestone
            ? ['💬', milestone.role]
            : ['👋', 'Vem comigo conhecer minha trajetória!'])));
        story.replaceChildren();
        const title = document.createElement('h3');
        title.textContent = milestone?.name ?? 'Primeiros passos';
        story.append(title);
        if (milestone) {
            const role = document.createElement('p');
            role.className = 'game-role';
            role.textContent = milestone.role;
            story.append(role);
        }
        const text = document.createElement('p');
        text.textContent = milestone?.description ?? 'Alcance a próxima plataforma para abrir o primeiro marco.';
        story.append(text);
    }

    function updateProgress() {
        progressBar.max = milestones.length;
        progressBar.value = visited.size;
        progress.textContent = visited.size === milestones.length
            ? 'Trajetória concluída · ' + milestones.length + ' marcos'
            : visited.size + ' de ' + milestones.length + ' marcos';
    }

    function respawn() {
        const platform = platforms[checkpoint];
        Object.assign(player, { x: platform.x + 34, y: platform.y, vy: 0, grounded: true });
        showMilestone(checkpoint);
    }

    function drawBackground(camera) {
        const sky = ctx.createLinearGradient(0, 0, 0, stageHeight);
        sky.addColorStop(0, '#243958');
        sky.addColorStop(1, '#657a91');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, viewport, stageHeight);
        ctx.fillStyle = '#ffe0a9';
        ctx.beginPath();
        ctx.arc(viewport * .78, 92, 38, 0, Math.PI * 2);
        ctx.fill();

        for (let i = -1; i <= Math.ceil(viewport / 100) + 1; i++) {
            const x = i * 100 - (camera * .16) % 100;
            ctx.fillStyle = '#526b85';
            ctx.beginPath();
            ctx.moveTo(x - 70, 310);
            ctx.lineTo(x + 23, 165 + Math.abs(i % 3) * 18);
            ctx.lineTo(x + 130, 310);
            ctx.fill();
        }

        for (let i = -1; i <= Math.ceil(viewport / 48) + 1; i++) {
            const x = i * 48 - (camera * .32) % 48;
            const top = 248 + Math.abs(i * 13 % 53);
            ctx.fillStyle = '#324b65';
            ctx.fillRect(x, top, 35, stageHeight - top);
            ctx.fillStyle = '#8395a0';
            for (let y = top + 11; y < stageHeight; y += 15) {
                ctx.fillRect(x + 7, y, 4, 5);
                ctx.fillRect(x + 21, y, 4, 5);
            }
        }
        ctx.fillStyle = '#172b41';
        ctx.fillRect(0, stageHeight - 14, viewport, 14);
    }

    function drawPlatform(platform, index, camera) {
        const x = Math.round(platform.x - camera);
        if (x > viewport || x + platform.width < 0) return;
        const { y, width } = platform;
        ctx.fillStyle = '#182e45';
        ctx.fillRect(x, y, width, 17);
        ctx.fillRect(x + 8, y + 17, width - 16, 8);
        ctx.fillStyle = visited.has(index) ? '#98efcb' : '#79adbd';
        ctx.fillRect(x, y, width, 5);
        ctx.fillStyle = '#38546c';
        for (let offset = 12; offset < width; offset += 19) ctx.fillRect(x + offset, y + 9, 9, 3);

        const name = milestones[index - 1]?.name ?? 'Partida';
        ctx.fillStyle = '#122438';
        ctx.fillRect(x, y - 59, width, 26);
        ctx.fillStyle = visited.has(index) ? '#98efcb' : '#fff1d5';
        ctx.font = 'bold 12px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText(name, x + width / 2, y - 42, width - 8);
        ctx.fillRect(x + width - 12, y - 32, 2, 32);
        ctx.fillRect(x + width - 10, y - 28, 8, 5);
    }

    function drawPlayer(camera) {
        ctx.save();
        ctx.translate(Math.round(player.x - camera), Math.round(player.y));
        ctx.scale(player.facing, 1);
        const stride = reducedMotion.matches ? 0 : Math.round(Math.sin(player.step) * 3);
        const pixel = (color, x, y, width, height) => {
            ctx.fillStyle = color;
            ctx.fillRect(x, y, width, height);
        };
        // Personagem original desenhado em pixel art.
        pixel('#1b2235', -7, -38, 14, 12);
        pixel('#342b30', -8, -39, 13, 5);
        pixel('#d99b72', -5, -34, 12, 10);
        pixel('#e9b88a', -3, -34, 10, 7);
        pixel('#27374c', 3, -32, 2, 2);
        pixel('#244960', -9, -23, 5, 13);
        pixel('#72dcb4', -5, -24, 12, 14);
        pixel('#b2efd3', -3, -24, 9, 4);
        pixel('#d99b72', 7, -19 - stride, 4, 8);
        pixel('#263c59', -5 - stride, -10, 5, 8);
        pixel('#305371', 2 + stride, -10, 5, 8);
        pixel('#e7e9ee', -6 - stride, -3, 7, 3);
        pixel('#fff1d5', 2 + stride, -3, 7, 3);
        ctx.restore();
    }

    function render() {
        const finalPlatform = platforms.at(-1);
        const camera = Math.max(0, Math.min(
            player.x - viewport * .36, finalPlatform.x + finalPlatform.width + 70 - viewport
        ));
        drawBackground(camera);
        platforms.forEach((platform, index) => drawPlatform(platform, index, camera));
        drawPlayer(camera);
    }

    function resize() {
        viewport = Math.max(1, canvas.clientWidth);
        const density = Math.min(devicePixelRatio || 1, 2);
        canvas.width = Math.round(viewport * density);
        canvas.height = Math.round(stageHeight * density);
        ctx.setTransform(density, 0, 0, density, 0, 0);
        render();
    }

    function held(control) {
        return keys.has(control) || [...pointers.values()].includes(control);
    }

    function update(delta) {
        const direction = Number(held('right')) - Number(held('left'));
        if (direction) player.facing = direction;
        const end = platforms.at(-1);
        player.x = Math.max(8, Math.min(end.x + end.width + 40, player.x + direction * 3.5 * delta));
        if (direction && player.grounded) player.step += delta * .24;
        else player.step = 0;
        if (jumpRequested && player.grounded) player.vy = -11.7;
        jumpRequested = false;

        const lastY = player.y;
        player.vy += .56 * delta;
        player.y += player.vy * delta;
        player.grounded = false;
        if (player.vy >= 0) {
            const index = platforms.findIndex(({ x, y, width }) =>
                player.x + 5 > x && player.x - 5 < x + width && lastY <= y && player.y >= y
            );
            if (index !== -1) {
                player.y = platforms[index].y;
                player.vy = 0;
                player.grounded = true;
                if (index > 0 && !visited.has(index)) {
                    visited.add(index);
                    checkpoint = index;
                    updateProgress();
                }
                showMilestone(index);
                if (visited.size === milestones.length) {
                    running = false;
                    clearControls();
                }
            }
        }
        if (player.y > stageHeight + 45) respawn();
    }

    function tick(now) {
        const delta = Math.min((now - previous) / (1000 / 60), 1.5);
        previous = now;
        update(delta);
        render();
        if (running) frame = requestAnimationFrame(tick);
    }

    function clearControls() {
        keys.clear();
        pointers.clear();
        jumpRequested = false;
    }

    function startGame() {
        if (start.hidden) return;
        start.hidden = true;
        running = true;
        story.querySelector('h3').textContent = 'Fase iniciada';
        story.querySelector('p').textContent = 'Ande até perto da borda e pule mantendo a direção. A próxima plataforma abre o primeiro marco.';
        speak('🎮', 'Vamos para a RSI! Segure → para andar e use Espaço ou ↑ para pular.');
        canvas.focus({ preventScroll: true });
        previous = performance.now();
        frame = requestAnimationFrame(tick);
    }

    start.querySelector('button').addEventListener('click', startGame);

    shell.querySelector('.game-reset').addEventListener('click', () => {
        running = false;
        cancelAnimationFrame(frame);
        clearControls();
        visited.clear();
        checkpoint = 0;
        current = -1;
        player.facing = 1;
        player.step = 0;
        respawn();
        updateProgress();
        render();
        start.hidden = false;
        start.querySelector('button').focus({ preventScroll: true });
    });

    const keyboard = new Map([
        ['ArrowLeft', 'left'], ['KeyA', 'left'],
        ['ArrowRight', 'right'], ['KeyD', 'right'],
        ['Space', 'jump'], ['ArrowUp', 'jump'], ['KeyW', 'jump']
    ]);
    canvas.addEventListener('keydown', event => {
        if (!start.hidden && event.code === 'Enter') {
            event.preventDefault();
            startGame();
            return;
        }
        const control = keyboard.get(event.code);
        if (!running || !control) return;
        event.preventDefault();
        if (control === 'jump' && !event.repeat) jumpRequested = true;
        keys.add(control);
    });
    canvas.addEventListener('keyup', event => keys.delete(keyboard.get(event.code)));
    canvas.addEventListener('blur', () => keys.clear());
    window.addEventListener('blur', clearControls);

    for (const button of shell.querySelectorAll('[data-control]')) {
        button.addEventListener('pointerdown', event => {
            if (event.button !== 0) return;
            startGame();
            if (!running) return;
            event.preventDefault();
            const control = button.dataset.control;
            button.setPointerCapture(event.pointerId);
            pointers.set(event.pointerId, control);
            if (control === 'jump') jumpRequested = true;
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            button.addEventListener(type, event => pointers.delete(event.pointerId));
        }
    }

    shell.hidden = false;
    respawn();
    updateProgress();
    new ResizeObserver(resize).observe(canvas);
})();
