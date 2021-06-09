from flask.wrappers import Response
from werkzeug.wrappers import response
from game import Board
from predict import predict
import numpy as np
from pv_mcts import MCTSPlayer
from re import T
from flask import Flask, render_template, request
import json

app = Flask(__name__)


@app.route("/")
def hello():
    return render_template("index.html")


@app.route("/move", methods=["POST"])
def move():
    av = []
    data = json.loads(request.get_data().decode("utf-8"))
    move = json.loads(data["state"])
    move = {int(k): int(v) for k, v in move.items()}
    # print(data["av"])
    # for o in data["av"].split(","):
    #     av.append(int(o))
    return Response(response=str(getAction(data["av"], move)), status=200)


def getAction(av, move):
    board = Board(width=11, height=11, n_in_row=5)
    board.current_player = 2
    board.availables = av
    board.states = move
    mcts_player = MCTSPlayer(policy_value_fn, c_puct=5, n_playout=400)
    return mcts_player.get_action(board)


def policy_value_fn(board):
    legal_positions = board.availables
    current_state = np.ascontiguousarray(board.current_state().reshape(-1, 4, 11, 11))
    log_act_probs, value = predict(current_state)
    act_probs = np.exp(log_act_probs.flatten())
    act_probs = zip(legal_positions, act_probs[legal_positions])
    value = value[0][0]
    return act_probs, value


if __name__ == "__main__":
    app.run(debug=False)
