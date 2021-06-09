import onnxruntime
import numpy as np

session = onnxruntime.InferenceSession("best.onnx")
# print("input:")
# for session_input in session.get_inputs():
#     print(session_input.name, session_input.shape)
# # 出力のラベル名の確認
# print("output:")
# for session_output in session.get_outputs():
#     print(session_output.name, session_output.shape)


def predict(board):
    p = session.run(["273"], {"input.1": board.astype(np.float32)})
    v = session.run(["281"], {"input.1": board.astype(np.float32)})
    return np.array(p), np.array(v)
