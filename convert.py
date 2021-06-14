import tensorflow as tf

input_arrays = ["input.1"]
output_arrays = ["converted_array"]
converter = tf.compat.v1.lite.TFLiteConverter.from_saved_model("conveted.pb")
tflite_model = converter.convert()
open("test_model.tflite", "wb").write(tflite_model)
# onnx-tf convert -i best.onnx -o model.pb
# tensorflowjs_converter --input_format=tf_saved_model model.pb web_model
