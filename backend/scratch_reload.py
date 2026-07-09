import urllib.request
req = urllib.request.Request("http://localhost:8000/config/reload", data=b"", method="POST")
try:
    with urllib.request.urlopen(req) as response:
        print(response.read().decode())
except Exception as e:
    print(e)
