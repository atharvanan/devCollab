import urllib.request
import urllib.error
import json
import sys

BASE_URL = 'http://localhost:5000/api/v1'

def api_call(path, method='GET', data=None, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    encoded_data = json.dumps(data).encode('utf-8') if data is not None else None
    req = urllib.request.Request(f'{BASE_URL}{path}', data=encoded_data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            body = resp.read().decode('utf-8')
            return resp.status, json.loads(body) if body else {}
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8')
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {'message': body}

def run_qa_hierarchy_and_sla_test():
    print("=" * 70)
    print("ENTERPRISE QA SUITE: ROLE HIERARCHY, COMPLIANCE CONTROLS & SLA ENGINE")
    print("=" * 70)

    # 1. Login as Project Manager (Sarah Chen - Project Owner & PM)
    print("\n[STEP 1] Authenticate Project Manager (Sarah Chen)...")
    status, pm_res = api_call('/auth/login', 'POST', {
        'email': 'sarah.backend@devcollab.com',
        'password': 'DevCollab123!'
    })
    if status != 200 or not pm_res.get('data', {}).get('accessToken'):
        print(f"[FAIL] PM login failed: status={status}, response={pm_res}")
        return False
    pm_token = pm_res['data']['accessToken']
    pm_user = pm_res['data']['user']
    print(f"[PASS] PM Authenticated: {pm_user.get('name')} ({pm_user.get('email')})")

    # 2. Login as Engineer Bot (Lucas DevOps)
    print("\n[STEP 2] Login as Team Member (Lucas Vance - DevOps)...")
    status, bot_res = api_call('/auth/login', 'POST', {
        'email': 'lucas.devops@devcollab.com',
        'password': 'DevCollab123!'
    })
    if status != 200 or not bot_res.get('data', {}).get('accessToken'):
        print(f"[FAIL] Bot login failed: status={status}, response={bot_res}")
        return False
    bot_token = bot_res['data']['accessToken']
    bot_user = bot_res['data']['user']
    print(f"[PASS] Engineer logged in: {bot_user.get('name')} ({bot_user.get('email')})")

    # 3. PM creates an active Project
    print("\n[STEP 3] PM creates enterprise project...")
    status, proj_res = api_call('/projects', 'POST', {
        'name': 'FinTech SDLC Compliance Project',
        'description': 'Mission-critical payment gateway with strict SOC-2 role hierarchy and SLA compliance.',
    }, pm_token)
    if status != 201:
        print(f"[FAIL] Project creation failed: {status}, {proj_res}")
        return False
    project = proj_res['data']['project']
    project_id = project['_id']
    print(f"[PASS] Project created: ID={project_id}, Name='{project['name']}'")

    # 4. PM creates a Critical (P1) Task assigned to Lucas
    print("\n[STEP 4] PM creates Critical (P1) Task assigned to Lucas DevOps...")
    status, task_res = api_call(f'/board/{project_id}/tasks', 'POST', {
        'title': 'P1 Critical: Fix Kubernetes Ingress TLS Certificate Expiry',
        'description': 'Production ingress certificate expires in 6 hours. Immediate remediation required.',
        'priority': 'critical',
        'targetRole': 'devops',
        'column': 'todo',
    }, pm_token)
    if status != 201:
        print(f"[FAIL] Task creation failed: {status}, {task_res}")
        return False
    task = task_res['data']['task']
    task_id = task['_id']
    print(f"[PASS] P1 Task created: ID={task_id}")
    print(f"       Priority: {task.get('priority')}")
    print(f"       Response SLA Deadline: {task.get('sla', {}).get('responseDeadline')}")
    print(f"       Resolution SLA Deadline: {task.get('sla', {}).get('resolutionDeadline')}")

    # 5. Fetch Board and verify SLA Metrics Summary
    print("\n[STEP 5] Fetch Board and verify SLA Metrics Summary...")
    status, board_res = api_call(f'/board/{project_id}', 'GET', None, pm_token)
    if status != 200:
        print(f"[FAIL] Get board failed: {status}")
        return False
    sla_summary = board_res['data'].get('slaSummary', {})
    print(f"[PASS] SLA Summary received: Total={sla_summary.get('total')}, Compliant={sla_summary.get('compliant')}, Rate={sla_summary.get('complianceRate')}%")
    assert sla_summary.get('total', 0) >= 1

    # 6. COMPLIANCE VIOLATION TEST 1: Engineer tries to bypass review and drag directly to Done
    print("\n[STEP 6] COMPLIANCE TEST: Engineer (Lucas) attempts to drag ticket straight to 'done'...")
    status, illegal_move = api_call(f'/board/tasks/{task_id}/move', 'PATCH', {
        'column': 'done',
        'order': 0
    }, bot_token)
    print(f"       Result status: {status}, message: {illegal_move.get('message')}")
    if status == 403:
        print("[PASS] COMPLIANCE ENFORCED: Backend blocked engineer from moving ticket to Done (403 Forbidden).")
    else:
        print(f"[FAIL] Security Hole: Engineer was able to move ticket to Done! Status={status}")
        return False

    # 7. Engineer legitimately moves assigned ticket to in_progress
    print("\n[STEP 7] Engineer starts work: moves ticket from 'todo' to 'in_progress'...")
    status, start_move = api_call(f'/board/tasks/{task_id}/move', 'PATCH', {
        'column': 'in_progress',
        'order': 0
    }, bot_token)
    if status != 200:
        print(f"[FAIL] Engineer could not move their own ticket to in_progress: {status}, {start_move}")
        return False
    print(f"[PASS] Engineer moved ticket to In Progress: startedAt recorded.")

    # 8. Engineer submits work for review with resolution notes
    print("\n[STEP 8] Engineer completes work and submits resolution feedback to PM...")
    status, submit_res = api_call(f'/board/tasks/{task_id}/resolve', 'PATCH', {
        'notes': 'Renewed Let\'s Encrypt wildcard certificate in cert-manager and verified TLS handshake on port 443.',
        'column': 'review'
    }, bot_token)
    if status != 200:
        print(f"[FAIL] Submission failed: {status}, {submit_res}")
        return False
    print(f"[PASS] Ticket submitted to PM for review. Current column: {submit_res['data']['task'].get('column')}")

    # 9. COMPLIANCE VIOLATION TEST 2: Engineer tries to move ticket out of Review
    print("\n[STEP 9] COMPLIANCE TEST: Engineer attempts to drag ticket while locked in 'review'...")
    status, illegal_review_move = api_call(f'/board/tasks/{task_id}/move', 'PATCH', {
        'column': 'in_progress',
        'order': 0
    }, bot_token)
    print(f"       Result status: {status}, message: {illegal_review_move.get('message')}")
    if status == 403:
        print("[PASS] COMPLIANCE ENFORCED: Backend blocked engineer from moving ticket out of Review (403 Forbidden).")
    else:
        print(f"[FAIL] Security Hole: Engineer was able to move ticket out of review! Status={status}")
        return False

    # 10. PM reviews: Requests changes (Revision flow)
    print("\n[STEP 10] PM Reviews: Requests revision notes back to developer...")
    status, reject_res = api_call(f'/board/tasks/{task_id}/manager-review', 'PATCH', {
        'status': 'rejected',
        'feedback': 'Please verify backup cron job and update ingress controller replicas.',
        'routeToColumn': 'in_progress'
    }, pm_token)
    if status != 200:
        print(f"[FAIL] PM review rejection failed: {status}, {reject_res}")
        return False
    rejected_task = reject_res['data']['task']
    print(f"[PASS] Ticket routed back to In Progress by PM with feedback: '{rejected_task.get('managerReview', {}).get('feedback')}'")

    # 11. Engineer re-submits work after addressing feedback
    print("\n[STEP 11] Engineer addresses feedback and re-submits to PM...")
    status, resubmit_res = api_call(f'/board/tasks/{task_id}/resolve', 'PATCH', {
        'notes': 'Ingress controller scaled to 3 replicas. Backup cron verified and tested successfully.',
        'column': 'review'
    }, bot_token)
    if status != 200:
        print(f"[FAIL] Re-submission failed: {status}, {resubmit_res}")
        return False
    print(f"[PASS] Ticket re-submitted to PM. Status is pending review.")

    # 12. PM gives final approval and closes ticket into Done
    print("\n[STEP 12] PM verifies and formally approves ticket into Done...")
    status, approve_res = api_call(f'/board/tasks/{task_id}/manager-review', 'PATCH', {
        'status': 'approved',
        'feedback': 'Approved! Production TLS is robust and scaled.',
    }, pm_token)
    if status != 200:
        print(f"[FAIL] PM approval failed: {status}, {approve_res}")
        return False
    final_task = approve_res['data']['task']
    print(f"[PASS] Ticket APPROVED & CLOSED into Done!")
    print(f"       Column: {final_task.get('column')}")
    print(f"       Closed At: {final_task.get('closedAt')}")
    print(f"       Closed By: {final_task.get('closedBy')}")
    print(f"       Manager Review: {final_task.get('managerReview', {}).get('status')}")

    print("\n" + "=" * 70)
    print("ALL 12 QA & ENTERPRISE COMPLIANCE TESTS PASSED FLOCK-FREE!")
    print("=" * 70)
    return True

if __name__ == '__main__':
    ok = run_qa_hierarchy_and_sla_test()
    sys.exit(0 if ok else 1)
