#!/usr/bin/env python3
"""
Bridge between HikeLog (Node) and the open-source, UNOFFICIAL `garminconnect` library
(https://github.com/cyberjunky/python-garminconnect). Reads one JSON request on stdin, writes one JSON reply on stdout.
Nothing is written to disk: session tokens go back to HikeLog, which stores them encrypted.

Requests ("cmd"):
  login  {email, password}              -> {status: "ok", tokens} | {status: "needs_mfa", state}
  mfa    {state, code}                  -> {status: "ok", tokens}
  verify {tokens}                       -> {status: "ok", tokens}   (use an existing saved session instead of signing in)
  sync   {tokens, since, types, skip, max_new}   -> {status: "ok", tokens, activities: [{raw, gpx}]}
Errors: {status: "error", kind: "auth" | "rate_limit" | "connection" | "other", message}
"""
import json
import sys


def out(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()


def fail(kind, message):
    out({"status": "error", "kind": kind, "message": message})
    sys.exit(0)


try:
    from garminconnect import (
        Garmin,
        GarminConnectAuthenticationError,
        GarminConnectConnectionError,
        GarminConnectTooManyRequestsError,
    )
except Exception as e:  # pragma: no cover
    fail("other", f"The garminconnect Python library is not installed: {e}")


def classify(e):
    if isinstance(e, GarminConnectTooManyRequestsError):
        return "rate_limit"
    if isinstance(e, GarminConnectAuthenticationError):
        return "auth"
    if isinstance(e, GarminConnectConnectionError):
        return "connection"
    return "other"


def main():
    req = json.load(sys.stdin)
    cmd = req.get("cmd")
    try:
        if cmd == "login":
            g = Garmin(req["email"], req["password"], return_on_mfa=True)
            status, state = g.login()
            if status == "needs_mfa":
                return out({"status": "needs_mfa", "state": state})
            return out({"status": "ok", "tokens": g.client.dumps()})
        if cmd == "mfa":
            g = Garmin(return_on_mfa=True)
            g.resume_login(req["state"], str(req["code"]).strip())
            return out({"status": "ok", "tokens": g.client.dumps()})
        if cmd == "verify":
            g = Garmin()
            g.login(req["tokens"])
            return out({"status": "ok", "tokens": g.client.dumps()})
        if cmd == "sync":
            g = Garmin()
            g.login(req["tokens"])  # loads tokens, refreshes them if they are about to expire
            types = set(req.get("types") or [])
            skip = set(str(x) for x in (req.get("skip") or []))
            acts = g.get_activities_by_date(req["since"], None, None, "asc")
            result = []
            max_new = int(req.get("max_new") or 25)
            downloaded = 0
            more = False
            for a in acts:
                t = (a.get("activityType") or {}).get("typeKey", "")
                aid = str(a.get("activityId"))
                if types and t.lower() not in types:
                    continue
                if aid in skip:
                    result.append({"raw": a, "gpx": None})
                    continue
                if downloaded >= max_new:
                    more = True  # stay polite: the next Sync continues with the rest
                    break
                downloaded += 1
                gpx = None
                try:
                    blob = g.download_activity(aid, dl_fmt=g.ActivityDownloadFormat.GPX)
                    gpx = blob.decode("utf-8", "replace") if isinstance(blob, (bytes, bytearray)) else str(blob)
                except Exception:
                    gpx = None  # activity still imports; peak suggestions fall back to the title
                result.append({"raw": a, "gpx": gpx})
            return out({"status": "ok", "tokens": g.client.dumps(), "activities": result, "more": more})
        fail("other", f"Unknown command: {cmd}")
    except SystemExit:
        raise
    except Exception as e:
        fail(classify(e), str(e) or e.__class__.__name__)


main()
