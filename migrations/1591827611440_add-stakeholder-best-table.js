/* eslint-disable camelcase */

// Create stakeholder_best with identical schema to stakeholder

exports.shorthands = undefined;

exports.up = (pgm) => {
  pgm.createTable(
    { schema: "public", name: "stakeholder_best" },
    {},
    { like: "stakeholder" }
  );

  pgm.addConstraint(
    { schema: "public", name: "stakeholder_best" },
    "stakeholder_best_pk",
    "PRIMARY KEY(id)"
  );

  pgm.addConstraint(
    { schema: "public", name: "stakeholder_best" },
    "fk_stakeholder_neighborhood",
    "FOREIGN KEY (neighborhood_id) REFERENCES neighborhood(id)"
  );
};

exports.down = (pgm) => {
  pgm.dropTable({ schema: "public", name: "stakeholder_best" });
};
