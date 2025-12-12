/**
 * A basic client-side implementation of PCA for visualization purposes.
 * It uses a simplified covariance method and power iteration or basic projection
 * if full eigen decomposition is too heavy. Here we implement a basic covariance + eigen approach.
 */

import { DataRow } from "../types";

// Helper to calculate mean
const mean = (data: number[]): number => data.reduce((a, b) => a + b, 0) / data.length;

// Helper to center data
const center = (data: number[][], means: number[]): number[][] => {
  return data.map(row => row.map((val, i) => val - means[i]));
};

// Calculate Covariance Matrix
const calculateCovarianceMatrix = (centered: number[][]): number[][] => {
  const n = centered.length;
  const features = centered[0].length;
  const cov = Array(features).fill(0).map(() => Array(features).fill(0));

  for (let i = 0; i < features; i++) {
    for (let j = i; j < features; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += centered[k][i] * centered[k][j];
      }
      const val = sum / (n - 1);
      cov[i][j] = val;
      cov[j][i] = val;
    }
  }
  return cov;
};

// Jacobi Eigenvalue Algorithm (Simplified for real symmetric matrices like Covariance)
// Returns list of { eigenvalue, eigenvector }
const jacobi = (matrix: number[][], maxIter = 100): { values: number[], vectors: number[][] } => {
  const n = matrix.length;
  // Explicitly type V as number[][] to prevent TypeScript from inferring (0 | 1)[][]
  let V: number[][] = Array(n).fill(0).map((_, i) => Array(n).fill(0).map((__, j) => (i === j ? 1 : 0))); // Identity
  let D = matrix.map(row => [...row]); // Copy

  for (let iter = 0; iter < maxIter; iter++) {
    // Find max off-diagonal element
    let maxVal = 0;
    let p = 0, q = 0;
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (Math.abs(D[i][j]) > maxVal) {
          maxVal = Math.abs(D[i][j]);
          p = i;
          q = j;
        }
      }
    }

    if (maxVal < 1e-9) break; // Converged

    const phi = 0.5 * Math.atan2(2 * D[p][q], D[p][p] - D[q][q]);
    const c = Math.cos(phi);
    const s = Math.sin(phi);

    // Update D (diagonal matrix)
    const Dpp = D[p][p];
    const Dqq = D[q][q];
    const Dpq = D[p][q];

    D[p][p] = c * c * Dpp - 2 * s * c * Dpq + s * s * Dqq;
    D[q][q] = s * s * Dpp + 2 * s * c * Dpq + c * c * Dqq;
    D[p][q] = 0;
    D[q][p] = 0;

    for (let i = 0; i < n; i++) {
      if (i !== p && i !== q) {
        const Dip = D[i][p];
        const Diq = D[i][q];
        D[i][p] = c * Dip - s * Diq;
        D[p][i] = D[i][p];
        D[i][q] = s * Dip + c * Diq;
        D[q][i] = D[i][q];
      }
    }

    // Update V (eigenvectors)
    for (let i = 0; i < n; i++) {
      const Vip = V[i][p];
      const Viq = V[i][q];
      V[i][p] = c * Vip - s * Viq;
      V[i][q] = s * Vip + c * Viq;
    }
  }

  const eigenvalues = D.map((row, i) => row[i]);
  // Transpose V to get eigenvectors as rows if needed, but currently columns correspond to eigenvalues
  const eigenvectors = Array(n).fill(0).map((_, i) => V.map(row => row[i])); 

  return { values: eigenvalues, vectors: eigenvectors };
};

export interface PCAResult {
    data: { x: number; y: number; id: string | number; [key: string]: any }[];
    loadings: {
        pc1: { name: string; value: number }[];
        pc2: { name: string; value: number }[];
    };
}

export const calculatePCA = (
  rows: DataRow[],
  columns: string[]
): PCAResult => {
  if (rows.length === 0 || columns.length < 2) return { data: [], loadings: { pc1: [], pc2: [] } };

  // 1. Extract and Clean Data
  const rawData: number[][] = rows.map(row => {
    return columns.map(col => {
      const val = parseFloat(row[col]);
      return isNaN(val) ? 0 : val; // Simple imputation
    });
  });

  // 2. Center Data
  const means = columns.map((_, i) => mean(rawData.map(r => r[i])));
  const centered = center(rawData, means);

  // 3. Covariance
  const cov = calculateCovarianceMatrix(centered);

  // 4. Eigen Decomposition
  const { values, vectors } = jacobi(cov);

  // 5. Sort by Eigenvalue (descending)
  const indices = values.map((val, i) => ({ val, i }))
    .sort((a, b) => b.val - a.val)
    .map(item => item.i);

  // 6. Project to Top 2 Components
  const top2Indices = indices.slice(0, 2);
  const pc1 = vectors[top2Indices[0]];
  const pc2 = vectors[top2Indices[1]];

  // If we couldn't find 2 components (e.g., 1 variable), handle gracefully
  if (!pc1 || !pc2) return { data: [], loadings: { pc1: [], pc2: [] } };

  const projected = centered.map((row, rowIndex) => {
    const x = row.reduce((sum, val, i) => sum + val * pc1[i], 0);
    const y = row.reduce((sum, val, i) => sum + val * pc2[i], 0);
    return {
      x,
      y,
      id: rows[rowIndex].id,
      ...rows[rowIndex] // Pass through original data for tooltip
    };
  });
  
  // Format loadings for explainability
  const formatLoadings = (vec: number[]) => {
      return vec.map((val, i) => ({ name: columns[i], value: val }))
                .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  };

  return {
      data: projected,
      loadings: {
          pc1: formatLoadings(pc1),
          pc2: formatLoadings(pc2)
      }
  };
};