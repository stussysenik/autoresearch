import json

import Rhino
import scriptcontext as sc


RESULT_PATH = "/Users/s3nik/Desktop/rhino-nlcli/var/rhino_python_probe_result.json"


def main():
    sphere = Rhino.Geometry.Sphere(Rhino.Geometry.Point3d.Origin, 55.0)
    object_id = sc.doc.Objects.AddSphere(sphere)
    sc.doc.Views.Redraw()
    with open(RESULT_PATH, "w") as result_file:
        result_file.write(json.dumps({"status": "ok", "object_id": str(object_id)}))


main()
