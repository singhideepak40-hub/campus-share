/**
 * CampusShare v2 - Domain Module: Eligibility Graph
 * Pure TypeScript/JavaScript recursive prerequisite graph solver.
 * Traverses credential dependency trees, identifies missing gates,
 * and yields actionable 1-click remediation paths.
 */

/**
 * Resolves recursive prerequisites for a given credential.
 * @param {string} rootCredId
 * @param {Array<{ credential_id: string, requires_credential_id: string }>} prereqGraph
 * @returns {Set<string>} All required credential IDs
 */
function resolveAllPrerequisites(rootCredId, prereqGraph) {
  const required = new Set();
  const queue = [rootCredId];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!required.has(current)) {
      required.add(current);
      const immediatePrereqs = prereqGraph
        .filter(edge => edge.credential_id === current)
        .map(edge => edge.requires_credential_id);
      for (const p of immediatePrereqs) {
        if (!required.has(p)) {
          queue.push(p);
        }
      }
    }
  }

  return required;
}

/**
 * Evaluates whether a user is eligible to book a resource.
 * @param {Object} params
 * @param {string} params.resourceId
 * @param {Array<{ resource_id: string, credential_id: string }>} params.resourceRequirements
 * @param {Array<{ credential_id: string, requires_credential_id: string }>} params.credentialPrereqs
 * @param {Array<{ id: string, name: string, training_resource_id?: string }>} params.allCredentials
 * @param {Array<{ credential_id: string, status: string, expires_at: string | Date }>} params.userCredentials
 * @param {Date} [params.now]
 * @returns {{ eligible: boolean, required: string[], missing: string[], satisfied: string[], remediation: Array<{ credentialId: string, name: string, trainingResourceId?: string }> }}
 */
function checkEligibility({
  resourceId,
  resourceRequirements,
  credentialPrereqs,
  allCredentials,
  userCredentials,
  now = new Date()
}) {
  const directRequirements = resourceRequirements
    .filter(r => r.resource_id === resourceId)
    .map(r => r.credential_id);

  const allRequiredCreds = new Set();
  for (const direct of directRequirements) {
    const subPrereqs = resolveAllPrerequisites(direct, credentialPrereqs);
    subPrereqs.forEach(c => allRequiredCreds.add(c));
  }

  const satisfiedCreds = new Set();
  const currentDate = new Date(now);

  for (const uc of userCredentials) {
    if (uc.status === 'verified') {
      const expiresAt = new Date(uc.expires_at);
      if (expiresAt > currentDate) {
        satisfiedCreds.add(uc.credential_id);
      }
    }
  }

  const requiredList = Array.from(allRequiredCreds);
  const missingList = requiredList.filter(id => !satisfiedCreds.has(id));
  const satisfiedList = requiredList.filter(id => satisfiedCreds.has(id));

  const credMap = new Map();
  allCredentials.forEach(c => credMap.set(c.id, c));

  const remediation = missingList.map(id => {
    const cred = credMap.get(id);
    return {
      credentialId: id,
      name: cred ? cred.name : id,
      trainingResourceId: cred ? cred.training_resource_id : null
    };
  });

  return {
    eligible: missingList.length === 0,
    required: requiredList,
    satisfied: satisfiedList,
    missing: missingList,
    remediation
  };
}

module.exports = {
  resolveAllPrerequisites,
  checkEligibility
};
