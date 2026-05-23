## Description

Provide a clear summary of the changes proposed in this Pull Request. Explain what problem this solves, the implementation details, and any architectural decisions made.

Fixes # (issue)

---

## Type of Change

Please mark the options that apply to this Pull Request:

- [ ] **Bug Fix** (non-breaking change which fixes an issue)
- [ ] **New Feature** (non-breaking change which adds functionality)
- [ ] **Refactoring & Modularization** (improving existing codebase design and files)
- [ ] **Documentation / Templates Update** (changes to instructions, guidelines, or repository metadata)
- [ ] **Security Fix** (vulnerability mitigation or secure rules updates)

---

## Verification & Testing

Explain how you have verified your changes. Please include details of your testing environment, specific inputs/outputs used, and execution outcomes.

### Syntax Verification
All JavaScript files modified in this PR must pass verification check:
```bash
node -c <modified_file_path>
```
- [ ] Checked all modified backend JS files using `node -c` (output is blank/valid).
- [ ] Checked all modified mobile-app JS files using `node -c` (output is blank/valid).

### Manual / Device Verification
- **Device / Emulator Used**: [e.g., iPhone 15 Simulator / Android physical device]
- **Expo Version / Node Version**: [e.g., Expo 54, Node 18.20]
- **Details of verification**: (Describe the exact steps run inside the app or the backend endpoints tested with postman/curl)

---

## Pull Request Checklist

Before submitting this Pull Request, please verify the following:

- [ ] My code follows the structural and style guidelines of this project.
- [ ] I have performed a comprehensive self-review of my own changes.
- [ ] I have commented my code, particularly in complex algorithm steps or fallback mechanisms.
- [ ] I have updated the main `README.md` or any local documentation if new features or variables were added.
- [ ] My changes generate no new warnings or console errors during execution.
- [ ] There are no hardcoded API keys, database credentials, or secret variables.
