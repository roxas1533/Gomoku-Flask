import os
from flask.wrappers import Response
from werkzeug.wrappers import response

import numpy as np

from flask import Flask, render_template, request
import json

app = Flask(__name__)


@app.route("/")
def hello():
    return render_template("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 3000))
    app.run(debug=False, host="0.0.0.0", port=port)
