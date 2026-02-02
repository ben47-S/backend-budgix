/**
 * Script de test pour vérifier que la configuration Swagger fonctionne
 */

import { swaggerSpec } from "../src/config/swagger";

console.log("🔍 Vérification de la configuration Swagger...\n");

// Vérifier que la spécification Swagger est générée
if (!swaggerSpec) {
  console.error("❌ Erreur : La spécification Swagger n'a pas été générée");
  process.exit(1);
}

// Vérifier les propriétés essentielles
const requiredProperties = ["openapi", "info", "paths", "components"];
const missingProperties = requiredProperties.filter(
  (prop) => !(prop in swaggerSpec)
);

if (missingProperties.length > 0) {
  console.error(
    `❌ Erreur : Propriétés manquantes dans la spécification Swagger : ${missingProperties.join(", ")}`
  );
  process.exit(1);
}

console.log("✅ Configuration Swagger valide");
const spec = swaggerSpec as any;
console.log(`📄 Version OpenAPI : ${spec.openapi || "N/A"}`);
console.log(`📚 Titre : ${spec.info?.title || "N/A"}`);
console.log(`📝 Version API : ${spec.info?.version || "N/A"}`);

// Compter les routes documentées
const paths = spec.paths || {};
const pathCount = Object.keys(paths).length;
console.log(`🛣️  Nombre de routes documentées : ${pathCount}`);

// Lister les tags
const tags = spec.tags || [];
console.log(`🏷️  Tags disponibles : ${tags.length}`);
tags.forEach((tag: any) => {
  console.log(`   - ${tag.name}: ${tag.description}`);
});

// Compter les schémas
const schemas = spec.components?.schemas || {};
const schemaCount = Object.keys(schemas).length;
console.log(`📋 Schémas de données : ${schemaCount}`);

console.log("\n✅ Tous les tests sont passés !");
console.log("\n📖 Pour accéder à la documentation :");
console.log("   - Interface Swagger UI : http://localhost:3000/api-docs");
console.log("   - JSON Swagger : http://localhost:3000/api-docs.json");

