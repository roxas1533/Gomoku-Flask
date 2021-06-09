let ctx;
let gameScene = 0;
let mouseX, mouseY;
let starB;
let retryB;
let clickObject = [];
let board;
let isThinking = false;
const range = (min, max, step = 1) =>
    Array.from({ length: ((max - 1) - min + step) / step }, (v, k) => min + k * step)
class Board {
    constructor() {
        this.states = {};
        this.availables = [];
        this.last_move = -1;
        this.turn = 0;
    }
    init() {
        this.current_player = 1;
        this.availables = [...Array(11 * 11).keys()];
        this.states = {};
        this.last_move = -1;
        this.turn = 0;
    }

    do_move(move) {
        this.states[move] = this.current_player;
        this.availables.splice(this.availables.indexOf(move), 1);
        this.current_player = this.current_player == 1 ? 2 : 1;
        this.last_move = move
        this.turn++;
    }
    has_a_winner(self) {
        const width = 11
        const height = 11
        const states = this.states
        const n = 5
        const all = new Set([...Array(width * height).keys()]);
        const av = new Set(this.availables);
        const moved = new Set([...all].filter(e => (!av.has(e))))
        if (moved.size < n * 2 - 1)
            return { win: false, winner: -1 };


        for (let i = 0; i < moved.size; i++) {
            let m = Array.from(moved)[i];
            let h = m / width | 0
            let w = m % width
            let player = states[String(m)]
            if (w in [...Array(width - n + 1).keys()] && (new Set(range(m, m + n).map((i) => { return states[String(i)] }))).size == 1) {
                return { win: true, winner: player };
            }
            if (h in [...Array(height - n + 1).keys()] && (new Set(range(m, m + n * width, width).map((i) => { return states[String(i)] }))).size == 1)
                return { win: true, winner: player };
            if (w in range(0, width - n + 1) && h in range(0, height - n + 1) &&
                (new Set(range(m, m + n * (width + 1), width + 1).map((i) => { return states[String(i)] }))).size == 1) {
                return { win: true, winner: player };
            }

            if (w in range(0, n - 1, width) && h in range(0, height - n + 1) &&
                (new Set(range(m, m + n * (width - 1), width - 1).map((i) => { return states[String(i)] }))).size == 1)
                return { win: true, winner: player };
        }

        return { win: false, winner: -1 };
    }
    game_end() {
        let { win, winner } = this.has_a_winner()
        if (win)
            return { win: true, winner: winner };
        else if (!this.availables.size)
            return { win: false, winner: -1 };
        return { win: false, winner: -1 };
    }

}
window.onload = function () {
    const canvas = document.querySelector('canvas');
    canvas.addEventListener("mousemove", (e) => {
        var rect = e.target.getBoundingClientRect()
        mouseX = e.clientX - rect.left;
        mouseY = e.clientY - rect.top;
    });
    canvas.addEventListener('click', (e) => {

        if (gameScene == 1 && board.turn % 2 == 0) {
            for (let i = 0; i < 11; i++) {
                for (let j = 0; j < 11; j++) {
                    if (mouseX > (i) * 50 && mouseX < (i + 1) * 50 && mouseY > (j) * 50 && mouseY < (j + 1) * 50) {
                        if (board.availables.indexOf(j * 11 + i) >= 0) {
                            board.do_move(j * 11 + i);

                            var { win: end, winner } = board.game_end();
                            console.log("1回目" + end);

                            if (end) {
                                gameScene = 2;
                            }
                            if (gameScene == 1) {
                                isThinking = true;
                                fetch('/move', {
                                    method: 'POST',
                                    body: JSON.stringify({ "state": JSON.stringify(board.states), "av": board.availables })
                                }).then(response => { return response.text(); }).then(data => {
                                    isThinking = false;
                                    board.do_move(Number(data));
                                    var { win: end, winner } = board.game_end();
                                    console.log("2回目" + end);
                                    if (end) {
                                        gameScene = 2;
                                    }
                                })

                            }
                        }
                    }
                }

            }
        }
        clickObject.forEach(c => {
            c.click();
        });
    }, false);
    ctx = canvas.getContext('2d');
    ctx.font = "48px Meiryo";

    starB = new ClickButton("始める");
    retryB = new ClickButton("もう一度");
    board = new Board();
    board.init();
    starB.click = () => {
        if (starB.isMouseOver && gameScene == 0) {
            gameScene = 1;
        }
    }
    retryB.click = () => {
        if (retryB.isMouseOver && gameScene == 2) {
            gameScene = 1;
            board.init();
            retryB.isMouseOver = false;
        }
    }
    clickObject.push(starB);
    clickObject.push(retryB);

    window.requestAnimationFrame(render);
};


class ClickButton {
    constructor(text) {
        this.text = text;
        const m = ctx.measureText(text)
        this.width = m.width;
        this.height = m.actualBoundingBoxAscent + m.actualBoundingBoxDescent
        this.isMouseOver = false;
    }
    draw() {
        if (mouseX > 550 / 2 - 100 && mouseX < 550 / 2 + 100 && mouseY > 550 / 2 - 35 && 550 / 2 + 35 > mouseY) {
            ctx.fillStyle = '#FFFFFF55';
            ctx.fillRect(550 / 2 - 100, 550 / 2 - 35, 200, 70);
            this.isMouseOver = true;
        } else {
            this.isMouseOver = false;
        }
        ctx.fillStyle = 'black';
        ctx.strokeRect(550 / 2 - 100, 550 / 2 - 35, 200, 70);
        ctx.fillText(this.text, 550 / 2 - this.width / 2, 550 / 2 + (this.height) / 2);
        ctx.strokeStyle = 'white';
        ctx.strokeText(this.text, 550 / 2 - this.width / 2, 550 / 2 + (this.height) / 2);

    }

    click() {
    }
}

function render() {
    if (ctx ?? false) {
        if (gameScene == 0) {
            ctx.fillStyle = '#307bf2';
            ctx.fillRect(0, 0, 550, 550);
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'black';
            starB.draw();

        } else {
            ctx.fillStyle = '#307bf2';
            ctx.fillRect(0, 0, 550, 550);
            for (let i = 0; i < 11; i++) {
                for (let j = 0; j < 11; j++) {
                    if (mouseX > (i) * 50 && mouseX < (i + 1) * 50 && mouseY > (j) * 50 && mouseY < (j + 1) * 50
                        && gameScene == 1) {
                        if (board.availables.indexOf(j * 11 + i) >= 0 && board.turn % 2 == 0) {
                            ctx.fillStyle = '#FFFFFF55';
                            ctx.fillRect((i) * 50, (j) * 50, 50, 50);
                        }
                    }
                    loc = j * 11 + i
                    p = board.states[String(loc)]
                    if (p == 1) {
                        ctx.fillStyle = '#000000';
                        ctx.fillRect((i) * 50, (j) * 50, 50, 50);
                    }
                    else if (p == 2) {
                        ctx.fillStyle = '#FF0000';
                        ctx.fillRect((i) * 50, (j) * 50, 50, 50);
                    }
                }
                ctx.strokeStyle = 'black';
                ctx.beginPath();
                ctx.moveTo((i + 1) * 50, 0);
                ctx.lineTo((i + 1) * 50, 550);
                ctx.stroke();
                ctx.strokeStyle = 'black';
                ctx.beginPath();
                ctx.moveTo(0, (i + 1) * 50);
                ctx.lineTo(550, (i + 1) * 50);
                ctx.stroke();
            };
            if (isThinking) {
                ctx.fillStyle = '#00000044';
                ctx.fillRect(0, 0, 550, 550);
                let text = "思考中...";
                const m = ctx.measureText(text);
                ctx.fillStyle = '#000000';
                ctx.fillText(text, 550 / 2 - m.width / 2, 550 / 2 - 100)
            }
            if (gameScene == 2) {
                ctx.fillStyle = '#00000077';
                ctx.fillRect(0, 0, 550, 550);
                retryB.draw();
            }
        }
        window.requestAnimationFrame(render);
    }
}