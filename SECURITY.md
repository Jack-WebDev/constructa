# Security Policy

## Supported versions

Constructa is currently pre-release. Security fixes are applied to the latest code on the default branch; older commits and unpublished development versions are not supported separately.

## Reporting a vulnerability

Please do not report suspected vulnerabilities in a public issue, discussion, or pull request.

Use GitHub's private vulnerability reporting feature for this repository. If private reporting is not available, contact a maintainer privately using the contact information on their GitHub profile and include `Constructa security report` in the subject.

Include as much of the following as possible:

- The affected component and version or commit
- Steps required to reproduce the issue
- The potential impact
- A minimal proof of concept, if safe to share
- Any suggested mitigation

Do not access data that is not yours, disrupt services, or perform destructive testing while investigating a vulnerability.

Maintainers will acknowledge a report as soon as practical, investigate it, and coordinate disclosure and remediation with the reporter. Response times are best-effort while the project is in early development.

## Security model

Generator definitions are treated as untrusted data. Constructa's initial releases must not execute arbitrary user-provided JavaScript or expose secrets through generator configuration. Changes that affect parsing, validation, plugin execution, authentication, API keys, or generated-data persistence require additional security review.
