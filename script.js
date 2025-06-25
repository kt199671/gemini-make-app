// --- Matter.js modules ---
const { Engine, Render, Runner, World, Bodies, Body, Events, Composite, Composites, Common, Mouse, MouseConstraint } = Matter;

// --- Game constants ---
const a_width = 800;
const a_height = 600;

// --- DOM elements ---
const a_canvasContainer = document.querySelector('#canvas-container');
const a_startButton = document.querySelector('#start-button');
const a_resetButton = document.querySelector('#reset-button');

// --- Matter.js engine setup ---
const a_engine = Engine.create();
const a_world = a_engine.world;
const a_render = Render.create({
    element: a_canvasContainer,
    engine: a_engine,
    options: {
        width: a_width,
        height: a_height,
        wireframes: false,
        background: '#f4f7f9'
    }
});

Render.run(a_render);
const a_runner = Runner.create();
Runner.run(a_runner, a_engine);

// --- Game state ---
let a_isDrawing = false;
let a_currentLinePoints = [];
let a_drawnLines = [];
let a_emoji = null;
let a_goal = null;
let a_gameStarted = false;
let a_winMessage = null;

// --- Walls ---
const wallOptions = {
    isStatic: true,
    render: {
        fillStyle: '#34495e'
    }
};
World.add(a_world, [
    Bodies.rectangle(a_width / 2, -10, a_width, 20, wallOptions), // Top
    Bodies.rectangle(a_width / 2, a_height + 10, a_width, 20, wallOptions), // Bottom
    Bodies.rectangle(-10, a_height / 2, 20, a_height, wallOptions), // Left
    Bodies.rectangle(a_width + 10, a_height / 2, 20, a_height, wallOptions) // Right
]);

// --- Mouse control for drawing ---
const a_mouse = Mouse.create(a_render.canvas);
const a_mouseConstraint = MouseConstraint.create(a_engine, {
    mouse: a_mouse,
    constraint: {
        stiffness: 0.2,
        render: {
            visible: false
        }
    }
});
World.add(a_world, a_mouseConstraint);

// --- Drawing Logic ---
function handleMouseDown(event) {
    if (a_gameStarted || a_mouse.button !== -1) return;
    a_isDrawing = true;
    a_currentLinePoints = [{ x: a_mouse.position.x, y: a_mouse.position.y }];
}

function handleMouseMove(event) {
    if (!a_isDrawing || a_gameStarted) return;
    a_currentLinePoints.push({ x: a_mouse.position.x, y: a_mouse.position.y });
}

function handleMouseUp(event) {
    if (!a_isDrawing || a_gameStarted) return;
    a_isDrawing = false;
    if (a_currentLinePoints.length > 5) { // Ensure the line has some length
        const newLine = createLineBody(a_currentLinePoints);
        a_drawnLines.push(newLine);
        World.add(a_world, newLine);
    }
    a_currentLinePoints = [];
}

function createLineBody(points) {
    const simplifiedPoints = Matter.Svg.pathToVertices(points.map(p => `L ${p.x} ${p.y}`).join(' ').substring(1), 30);
    if (simplifiedPoints.length < 2) return;

    const lineBody = Bodies.fromVertices(
        (simplifiedPoints[0].x + simplifiedPoints[simplifiedPoints.length-1].x) / 2,
        (simplifiedPoints[0].y + simplifiedPoints[simplifiedPoints.length-1].y) / 2,
        [simplifiedPoints],
        {
            isStatic: true,
            render: {
                fillStyle: '#2c3e50',
                strokeStyle: '#2c3e50',
                lineWidth: 5
            }
        }
    );
    return lineBody;
}

// --- Game Logic Functions ---
function setupGame() {
    // Clear drawn lines
    a_drawnLines.forEach(line => World.remove(a_world, line));
    a_drawnLines = [];

    // Clear emoji and goal
    if (a_emoji) World.remove(a_world, a_emoji);
    if (a_goal) World.remove(a_world, a_goal);
    if (a_winMessage) World.remove(a_world, a_winMessage);
    a_emoji = null;
    a_goal = null;
    a_winMessage = null;


    // Create Goal
    a_goal = Bodies.rectangle(a_width - 100, a_height - 100, 80, 40, {
        isStatic: true,
        isSensor: true,
        render: {
            fillStyle: 'rgba(46, 204, 113, 0.7)',
            strokeStyle: '#2ecc71',
            lineWidth: 3
        }
    });
    World.add(a_world, a_goal);

    // Reset state
    a_gameStarted = false;
    a_startButton.disabled = false;
    a_render.options.background = '#f4f7f9';
}

function startGame() {
    if (a_gameStarted) return;
    a_gameStarted = true;
    a_startButton.disabled = true;

    // Create Emoji
    a_emoji = Bodies.circle(100, 50, 25, {
        restitution: 0.6,
        friction: 0.01,
        render: {
            sprite: {
                texture: 'https://em-content.zobj.net/source/twitter/376/smiling-face-with-smiling-eyes_1f60a.png',
                xScale: 0.07,
                yScale: 0.07
            }
        }
    });
    World.add(a_world, a_emoji);
}

function showWinMessage() {
    a_winMessage = Bodies.rectangle(a_width / 2, a_height / 2, 300, 100, {
        isStatic: true,
        isSensor: true,
        render: {
            fillStyle: 'rgba(255, 255, 255, 0.8)',
            strokeStyle: '#27ae60',
            lineWidth: 5
        }
    });
     World.add(a_world, a_winMessage);
     // This is a bit of a hack. We can't render text directly in matter.js easily.
     // A better approach would be to use an HTML element on top of the canvas.
     // For now, we'll just change the background color.
     a_render.options.background = '#e0ffe0';
}


// --- Event Listeners ---
a_startButton.addEventListener('click', startGame);
a_resetButton.addEventListener('click', setupGame);

Events.on(a_render, 'beforeRender', () => {
    // Keep mouse constraint enabled only before game starts
    a_mouseConstraint.constraint.stiffness = a_gameStarted ? 0 : 0.2;

    // Draw the line preview
    if (a_isDrawing && a_currentLinePoints.length > 1) {
        const context = a_render.context;
        context.beginPath();
        context.moveTo(a_currentLinePoints[0].x, a_currentLinePoints[0].y);
        a_currentLinePoints.forEach(point => {
            context.lineTo(point.x, point.y);
        });
        context.strokeStyle = '#95a5a6';
        context.lineWidth = 4;
        context.stroke();
    }
});

Events.on(a_engine, 'collisionStart', (event) => {
    if (!a_emoji || !a_goal) return;
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
        const pair = pairs[i];
        if ((pair.bodyA === a_emoji && pair.bodyB === a_goal) ||
            (pair.bodyB === a_emoji && pair.bodyA === a_goal)) {
            if (!a_winMessage) { // Prevent multiple triggers
                 showWinMessage();
                 Body.setStatic(a_emoji, true);
            }
        }
    }
});

// --- Initial Setup ---
Events.on(a_mouseConstraint, 'mousedown', handleMouseDown);
Events.on(a_mouseConstraint, 'mousemove', handleMouseMove);
Events.on(a_mouseConstraint, 'mouseup', handleMouseUp);

setupGame();
