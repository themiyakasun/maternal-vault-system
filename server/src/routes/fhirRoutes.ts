import { Router, Request, Response } from 'express';
import { fhirService } from '../services/fhirService.js';
import { localEncryptedDb } from '../db/localEncryptedDb.js';

const router = Router();

/**
 * GET /fhir/R4/Patient/:id
 * Returns a standard HL7 FHIR R4 Patient Resource
 */
router.get('/Patient/:id', (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    const cleanId = rawId.startsWith('#') ? rawId : `#${rawId}`;
    const patient = localEncryptedDb.getById(cleanId) || localEncryptedDb.getById(rawId);

    if (!patient) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-found',
            diagnostics: `Patient resource with ID '${rawId}' not found.`,
          },
        ],
      });
    }

    const fhirPatient = fhirService.toFhirPatient(patient);
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.status(200).json(fhirPatient);
  } catch (error: any) {
    return res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: error.message }],
    });
  }
});

/**
 * GET /fhir/R4/Bundle/:patientId
 * Returns complete longitudinal HL7 FHIR R4 Bundle for a patient
 */
router.get('/Bundle/:patientId', (req: Request, res: Response) => {
  try {
    const rawId = req.params.patientId;
    const cleanId = rawId.startsWith('#') ? rawId : `#${rawId}`;
    const patient = localEncryptedDb.getById(cleanId) || localEncryptedDb.getById(rawId);

    if (!patient) {
      return res.status(404).json({
        resourceType: 'OperationOutcome',
        issue: [
          {
            severity: 'error',
            code: 'not-found',
            diagnostics: `Bundle for patient ID '${rawId}' not found.`,
          },
        ],
      });
    }

    const bundle = fhirService.toFhirBundle(patient);
    res.setHeader('Content-Type', 'application/fhir+json');
    return res.status(200).json(bundle);
  } catch (error: any) {
    return res.status(500).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'exception', diagnostics: error.message }],
    });
  }
});

/**
 * POST /fhir/R4/Bundle
 * Ingests external HL7 FHIR R4 Bundle and persists into database
 * Conforms to: Section 4.4.3 (NFR-03) & Section 4.8.1
 */
router.post('/Bundle', async (req: Request, res: Response) => {
  try {
    const bundle = req.body;
    const result = await fhirService.ingestFhirBundle(bundle);

    res.setHeader('Content-Type', 'application/fhir+json');
    return res.status(201).json({
      resourceType: 'Bundle',
      type: 'transaction-response',
      entry: [
        {
          response: {
            status: '201 Created',
            location: `/fhir/R4/Patient/${result.patientId?.replace('#', '')}`,
          },
        },
      ],
      meta: {
        lastUpdated: new Date().toISOString(),
      },
    });
  } catch (error: any) {
    return res.status(400).json({
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code: 'invalid', diagnostics: error.message }],
    });
  }
});

export default router;
