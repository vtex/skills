This skill provides guidance for AI agents working with VTEX Custom VTEX IO Apps. Apply these constraints and patterns when assisting developers with apply when deciding or implementing permissions and authorization boundaries for VTEX IO apps. Covers manifest policies, outbound-access rules, least-privilege design, and how service routes or integrations map to explicit permissions. Use for deciding who is authorized to call or consume a capability, adding new integrations, exposing protected routes, or reviewing app permissions for overreach or missing access.

# Authorization & Policy Design

## When this skill applies

Use this skill when a VTEX IO app needs explicit permissions to call external services, consume VTEX resources, or expose access-controlled behavior.

- Adding an external API integration
- Consuming VTEX resources that require declared permissions
- Reviewing whether a route or client needs policy changes
- Tightening app permissions around an existing integration

Do not use this skill for:
- service runtime tuning
- HTTP handler structure
- frontend UI authorization behavior
- broader trust-boundary or sensitive-data modeling
- choosing between `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN`

## Decision rules

- Treat `manifest.json` policies as explicit declarations of what the app is allowed to access.
- Use this skill to decide what the app is authorized to do, not which runtime token identity should make the call.
- Add only the policies required for the integrations and resources the app actually uses.
- Use License Manager policies when the app needs access to VTEX platform resources protected by LM resource keys.
- Use app policies such as `"vendor.app-name:policy-name"` when the app consumes resources or operations exposed by another VTEX IO app through role-based policies.
- Use `outbound-access` when the app needs to call external HTTP services or URLs that are not covered by License Manager or app policies.
- Prefer narrowly scoped outbound-access declarations over wildcard hosts or paths.
- When exposing your own routes or operations, define access on the server side through resource-based policies, route protections, or auth directives instead of assuming consumers will declare something in their own manifest.
- A VRN (VTEX Resource Name) is the internal identifier format VTEX uses for resources and identities. Role-based policies use `resources` expressed as VRNs, and resource-based policies use `principals` expressed as VRNs.
- Use VRNs only where the platform expects them, especially in `service.json` resource-based policies or when interpreting authorization errors. Do not generate VRNs in `manifest.json` for consumer-side policy declarations.
- In resource-based policies, multiple `principals` are evaluated as alternatives, and explicit `deny` rules override `allow` rules.
- When exposing your own role-based policies, keep them minimal and operation-specific rather than broad catch-all permissions.
- Review policy requirements when adding a new client, external integration, or service route that depends on protected access.
- Keep route implementation and policy declaration aligned: if a route depends on a protected integration, make sure the permission boundary is visible and intentional.

Policy types at a glance:

- License Manager policy:

```json
{
  "policies": [
    { "name": "Sku.aspx" }
  ]
}
```

- App policy:

```json
{
  "policies": [
    { "name": "vtex.messages:graphql-translate-messages" }
  ]
}
```

- Outbound-access policy:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

- Resource-based route policy with app principal VRN:

```json
{
  "routes": {
    "privateStatus": {
      "path": "/_v/private/status/:code",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:apps:*:my-sponsor-account:*:app/vendor.partner-app@0.x"
          ]
        }
      ]
    }
  }
}
```

This route allows a specific IO app principal. Other apps remain denied by default because they do not match any allow rule.

- Resource-based route policy with VTEX ID principal VRN:

```json
{
  "routes": {
    "status": {
      "path": "/_v/status/:code",
      "public": false,
      "policies": [
        {
          "effect": "allow",
          "actions": ["POST"],
          "principals": [
            "vrn:vtex.vtex-id:-:bibi:-:user/vtexappkey-mcc77-HBXYAE"
          ]
        },
        {
          "effect": "deny",
          "actions": ["POST"],
          "principals": [
            "vrn:vtex.vtex-id:-:bibi:-:user/*@vtex.com"
          ]
        }
      ]
    }
  }
}
```

This is an advanced pattern for integrations that identify callers through a specific VTEX ID principal, including appkey-based contracts. Prefer app VRNs for IO-to-IO access when the caller is another VTEX IO app. VTEX IO auth tokens such as `AUTH_TOKEN`, `STORE_TOKEN`, and `ADMIN_TOKEN` play a different role: they authenticate requests to VTEX services and help preserve requester context, but they do not automatically replace route-level resource policies based on VRN principals.

## Hard constraints

### Constraint: Every protected integration must have an explicit supporting policy

If a client or route depends on access controlled by License Manager policies, role-based app policies, or `outbound-access`, the app MUST declare the corresponding permission explicitly in `manifest.json`. Resources protected by resource-based policies define access on the server side and do not require consumer apps to declare additional policies just for that server-side enforcement.

**Why this matters**

Without the required policy, the code may be correct but the platform will still block the access at runtime, leading to failures that are hard to debug from handler code alone.

**Detection**

If you see a new external host, VTEX resource, or protected capability being consumed, STOP and verify that the required consumer-side policy exists before merging the code. If the app is exposing a protected route or operation, STOP and confirm that the access rule is also enforced on the server side.

**Correct**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

**Wrong**

```json
{
  "policies": []
}
```

### Constraint: Outbound policies must follow least privilege

Outbound-access policies MUST be scoped as narrowly as practical for the target host and path.

**Why this matters**

Broad outbound rules increase risk, make reviews harder, and allow integrations to expand silently beyond their intended surface.

**Detection**

If you see wildcard hosts or overly broad paths when the integration uses a much smaller surface, STOP and narrow the declaration.

**Correct**

```json
{
  "name": "outbound-access",
  "attrs": {
    "host": "partner.example.com",
    "path": "/orders/*"
  }
}
```

**Wrong**

```json
{
  "name": "outbound-access",
  "attrs": {
    "host": "*",
    "path": "/*"
  }
}
```

### Constraint: Policy changes must be reviewed together with the behavior they enable

When a policy is added or widened, the route or integration behavior that depends on it MUST be reviewed in the same change.

**Why this matters**

Permissions are meaningful only in context. Reviewing a policy change without the code that consumes it makes overreach and hidden side effects easier to miss.

**Detection**

If a PR changes `manifest.json` permissions without showing the relevant route, client, or integration code, STOP and request the linked behavior before approving.

**Correct**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/orders/*"
      }
    }
  ]
}
```

**Wrong**

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/api/*"
      }
    }
  ]
}
```

This broader policy alone does not explain why the app needs the expanded access.

## Preferred pattern

Start from the client or route behavior, identify the minimal access needed, and declare only that permission in `manifest.json`. When the app exposes protected routes or operations, define the resource-based access rule on the server side as part of the same review.

Example pattern:

```json
{
  "policies": [
    {
      "name": "outbound-access",
      "attrs": {
        "host": "partner.example.com",
        "path": "/orders/*"
      }
    }
  ]
}
```

Review permissions whenever integrations change, not only when policy errors appear in runtime.

## Common failure modes

- Forgetting the outbound-access policy for a new external integration.
- Using an outbound-access policy when the real requirement is a License Manager resource key or an app policy exposed by another VTEX IO app.
- Using wildcard hosts or paths when a narrower declaration would work.
- Assuming consumer apps must declare manifest policies for resources that are actually enforced through resource-based policies on the server side.
- Adding permissions without reviewing the route or client behavior they enable.
- Treating policy failures as code bugs instead of permission bugs.
- Treating a `403` that names a VRN resource or principal as a handler bug instead of an authorization or policy-mapping problem.

## Review checklist

- [ ] Does every protected integration have an explicit policy?
- [ ] Is the policy type correct for the access pattern: License Manager, app policy, or outbound-access?
- [ ] Are outbound-access rules narrow enough for the real integration surface?
- [ ] If the app exposes protected routes or operations, is server-side access control defined explicitly as well?
- [ ] Is the policy change reviewed together with the route or client that needs it?
- [ ] Are wildcard permissions avoided unless strictly necessary?

## Reference

- [Policies](https://developers.vtex.com/docs/guides/vtex-io-documentation-policies) - Policy types and manifest declaration
- [Accessing external resources within a VTEX IO app](https://developers.vtex.com/docs/guides/accessing-external-resources-within-a-vtex-io-app) - Outbound-access policy guidance
- [Policies from License Manager](https://developers.vtex.com/docs/guides/policies-from-license-manager) - License Manager resource keys and policy usage
- [Controlling access to app resources](https://developers.vtex.com/docs/guides/controlling-access-to-app-resources) - Role-based and resource-based access for your own app resources
- [VTEX Resource Name (VRN)](https://developers.vtex.com/docs/guides/vtex-io-documentation-vrn) - How VTEX expresses resources and principals in policies
- [Manifest](https://developers.vtex.com/docs/guides/vtex-io-documentation-manifest) - App contract and permission declaration
