let ctx;
let gameScene = -1;
let mouseX, mouseY;
let starB;
let retryB;
let clickObject = [];
let board;
let isThinking = false;
let model;
let mcts_player;
const range = (min, max, step = 1) =>
    Array.from({length: ((max - 1) - min + step) / step}, (v, k) => min + k * step)

class Board {
    constructor() {
        this.states = {};
        this.availables = [];
        this.last_move = -1;
        this.turn = 0;
        this.current_player = -1;
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

    has_a_winner() {
        const width = 11
        const height = 11
        const states = this.states
        const n = 5
        const all = new Set([...Array(width * height).keys()]);
        const av = new Set(this.availables);
        const moved = new Set([...all].filter(e => (!av.has(e))))
        if (moved.size < n * 2 - 1)
            return {win: false, winner: -1};


        for (let i = 0; i < moved.size; i++) {
            let m = Array.from(moved)[i];
            let h = m / width | 0
            let w = m % width
            let player = states[String(m)]
            if (w in [...Array(width - n + 1).keys()] && (new Set(range(m, m + n).map((i) => {
                return states[String(i)]
            }))).size == 1) {
                return {win: true, winner: player};
            }
            if (h in [...Array(height - n + 1).keys()] && (new Set(range(m, m + n * width, width).map((i) => {
                return states[String(i)]
            }))).size == 1)
                return {win: true, winner: player};

            if (range(0, width - n + 1).includes(w) && range(0, height - n + 1).includes(h) &&
                (new Set(range(m, m + n * (width + 1), width + 1).map((i) => {
                    return states[String(i)]
                }))).size == 1) {
                return {win: true, winner: player};
            }
            if (range(n - 1, width).includes(w) && range(0, height - n + 1).includes(h) &&
                (new Set(range(m, m + n * (width - 1), width - 1).map((i) => {
                    return states[String(i)]
                }))).size == 1)
                return {win: true, winner: player};
        }

        return {win: false, winner: -1};
    }

    current_state() {
        let square_state = Array.from(new Array(1), () => Array.from(new Array(4), () => {
            return Array.from(new Array(11), () => new Array(11).fill(0))
        }));
        if (this.states) {
            let move_curr = [];
            let move_oppo = [];

            for (const p in this.states) {
                if (this.states[p] == this.current_player)
                    move_curr.push(p);
                else
                    move_oppo.push(p);
            }

            move_curr.map(l => square_state[0][0][l / 11 | 0][l % 11] = 1.0)
            move_oppo.map(l => square_state[0][1][l / 11 | 0][l % 11] = 1.0)

            square_state[0][2][this.last_move / 11 | 0][this.last_move % 11] = 1.0
        }
        if ((Object.keys(this.states).length) % 2 == 0) {
            square_state[0][3] = Array.from(new Array(11), () => new Array(11).fill(1));
        }
        return square_state
    }

    game_end() {
        let {win, winner} = this.has_a_winner()
        if (win)
            return {win: true, winner: winner};
        else if (!this.availables.size)
            return {win: false, winner: -1};
        return {win: false, winner: -1};
    }

}

class TreeNode {
    constructor(parent, prior_p) {
        this.parent = parent;
        this.children = {};
        this.n_visits = 0;
        this.Q = 0;
        this.u = 0;
        this.P = prior_p;
    }

    async expand(action_priors) {
        let {action, prob} = action_priors;
        for (let i = 0; i < action.length; i++) {
            // console.log(action)
            if (!(action[i] in this.children)) {
                this.children[action[i]] = new TreeNode(this, prob[i]);
            }
        }
    }

    select(c_puct) {
        let max = -Infinity;
        let returnKey = 0;
        for (let [key, value] of Object.entries(this.children)) {
            if (max < value.get_value(c_puct)) {
                max = value.get_value(c_puct);
                returnKey = key;
            }

        }
        return {"action": returnKey, "node": this.children[returnKey]}
    }

    update(leaf_value) {
        this.n_visits += 1
        this.Q += 1.0 * (leaf_value - this.Q) / this.n_visits

    }

    update_recursive(leaf_value) {
        if (this.parent ?? false) {
            this.parent.update_recursive(-leaf_value)
        }
        this.update(leaf_value)
    }

    get_value(c_puct) {
        this.u = (c_puct * this.P * Math.sqrt(this.parent.n_visits) / (1 + this.n_visits))

        return this.Q + this.u
    }

    is_leaf() {
        return Object.keys(this.children).length == 0;
    }

    is_root() {
        return this.parent ?? false
    }

}

function softmax(logits) {
    const maxLogit = Math.max(...logits);
    const scores = logits.map(l => Math.exp(l - maxLogit));

    const denom = scores.reduce((a, b) => a + b);
    const re = scores.map(s => s / denom);
    return re;
}

async function run() {
    // load model
    const path = "/Gomoku-Flask/static/web_model/model.json";
    // const path = "/static/web_model/model.json";
    model = await tf.loadGraphModel(path);
    gameScene = 0;
}

async function predict(board) {
    // predict
    const xs = tf.tensor4d(board);
    y_pred = await model.predict(xs);
    const policyTns = await y_pred[0].data();
    const valuesTns = await y_pred[1].data();
    const value = Array.from(valuesTns);
    const policy = Array.from(policyTns);
    return {policy, value}
}

async function policy_value_fn(board) {
    let legal_positions = board.availables
    let current_state = board.current_state()
    let {policy, value} = await predict(current_state)
    let act_probs = policy.flat().map(p => Math.exp(p));

    act_probs = {"action": legal_positions, "prob": legal_positions.map(l => act_probs[l])}
    value = value[0]
    return {"action_probs": act_probs, "leaf_value": value}
}

class MCTS {
    constructor(policy_value_fn, c_puct, n_playout = 1000) {
        this._root = new TreeNode(undefined, 1.0)
        this._policy = policy_value_fn
        this._c_puct = c_puct
        this._n_playout = n_playout
    }

    async _playout(state) {
        var node = this._root
        while (true) {

            if (node.is_leaf())
                break
            var {action, node} = node.select(this._c_puct)
            // sum(10, 8n);
            state.do_move(action)
        }
        let {action_probs, leaf_value} = await this._policy(state)
        let {win, winner} = state.game_end()

        if (!win)
            await node.expand(action_probs)
        else {
            if (winner == -1)
                leaf_value = 0.0
            else
                leaf_value = winner == state.get_current_player ? 1.0 : -1.0
        }
        node.update_recursive(-leaf_value)
    }

    async get_move_probs(state, temp = 1e-3) {
        for (let n = 0; n < this._n_playout; n++) {
            let state_copy = copy(state)
            await this._playout(state_copy)
        }
        let acts = [];
        let visits = [];
        for (let [key, value] of Object.entries(this._root.children)) {
            acts.push(Number(key));
            visits.push(value.n_visits);
        }
        let act_probs = softmax(visits.map(l => l + 1e-10).map(p => Math.log(p)).map(logged => logged * (1.0 / 1e-3)))
        return {acts, act_probs}
    }

    update_with_move(last_move) {
        if (last_move in this._root.children) {
            this._root = this._root.children[last_move];
            this._root.parent = undefined;
        } else
            this._root = new TreeNode(undefined, 1.0);
    }

}

function randomChoice(p) {
    let rnd = p.reduce((a, b) => a + b) * Math.random();
    return p.findIndex(a => (rnd -= a) < 0);
    // return p.indexOf(Math.max(...p))
}

class MCTSPlayer {
    constructor(policy_value_function, c_puct, n_playout) {
        this.mcts = new MCTS(policy_value_function, c_puct, n_playout)
    }

    set_player_ind(p) {
        this.player = p
    }

    reset_player(self) {
        this.mcts.update_with_move(-1)
    }

    async get_action(board, temp = 1e-3) {
        let sensible_moves = board.availables

        let move_probs = [...Array(11 * 11).keys()]
        if (sensible_moves.length > 0) {
            let {"acts": acts, "act_probs": probs} = await this.mcts.get_move_probs(board, temp)
            move_probs.map(m => probs)
            for (let i = 0; i < acts.size; i++) {
                move_probs[acts[i]] = probs;
            }
            const move = acts[randomChoice(probs)];
            this.mcts.update_with_move(-1)
            return move
        } else {
            console.log("WARNING: the board is full");
        }

    }

}

function copy(board) {
    let newBoard = new Board();
    newBoard.last_move = board.last_move;
    newBoard.turn = board.turn;
    newBoard.current_player = board.current_player;
    newBoard.states = ([board.states].map(list => ({...list})))[0]
    newBoard.availables = JSON.parse(JSON.stringify(board.availables))
    return newBoard;
}

async function get_action(mcts_player, board) {
    const move = await mcts_player.get_action(board);
    board.do_move(move);
    isThinking = false;
    var {win: end, winner} = board.game_end();
    if (end) {
        gameScene = 2;
    }
    return move;
}

window.onload = function () {
    run();
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
                            var {win: end, winner} = board.game_end();

                            if (end) {
                                gameScene = 2;
                            }
                            if (gameScene == 1) {
                                isThinking = true;
                                const move = get_action(mcts_player, board);

                                // fetch('/move', {
                                //     method: 'POST',
                                //     body: JSON.stringify({ "state": JSON.stringify(board.states), "av": board.availables })
                                // }).then(response => { return response.text(); }).then(data => {
                                //     isThinking = false;
                                //     board.do_move(Number(data));
                                //     var { win: end, winner } = board.game_end();
                                //     console.log("2回目" + end);
                                //     if (end) {
                                //         gameScene = 2;
                                //     }
                                // })

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
    mcts_player = new MCTSPlayer(policy_value_fn, 5, 400)
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
        if (gameScene == -1) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, 550, 550);
            ctx.fillStyle = 'white';
            const m = ctx.measureText("loading...");
            ctx.fillText("loading...", 550 / 2 - m.width / 2, 550 / 2);

        } else if (gameScene == 0) {
            ctx.fillStyle = '#307bf2';
            ctx.fillRect(0, 0, 550, 550);
            ctx.strokeStyle = 'black';
            ctx.fillStyle = 'black';
            starB.draw();

        } else {
            ctx.fillStyle = '#00A0FF';
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
                    // ctx.fillStyle = "#000000"
                    // ctx.font = "15px Meiryo";

                    // ctx.fillText("" + loc, i * 50, (j + 1) * 50);
                    // ctx.font = "48px Meiryo";

                    p = board.states[String(loc)]
                    if (p == 1) {
                        ctx.strokeStyle = '#FFFFFF';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.arc((i) * 50 + 25, (j) * 50 + 25, 15, 0, 2 * Math.PI);
                        ctx.stroke();
                        ctx.lineWidth = 1;
                    } else if (p == 2) {
                        ctx.strokeStyle = '#5D5D5D';
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo((i) * 50 + 10, (j) * 50 + 10);
                        ctx.lineTo((i) * 50 + 30 + 10, (j) * 50 + 30 + 10);
                        ctx.stroke();
                        ctx.beginPath();
                        ctx.moveTo((i) * 50 + 30 + 10, (j) * 50 + 10);
                        ctx.lineTo((i) * 50 + 10, (j) * 50 + 30 + 10);
                        ctx.stroke();
                        ctx.lineWidth = 1;
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
            }
            ;
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
