with open('scratch/qa_hierarchy_sla_test.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    "api_call(f'/board/tasks/{task_id}/submit-resolution', 'POST',",
    "api_call(f'/board/tasks/{task_id}/resolve', 'PATCH',"
)

with open('scratch/qa_hierarchy_sla_test.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Updated route in qa_hierarchy_sla_test.py")

