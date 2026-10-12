# Software inventory package migration

`@red-cup-engineering/software-inventory-service@0.0.1` explicitly supersedes
the locally published experimental package
`@red-cup-engineering/software-estate-circuit-service@0.0.1`.

The product is a software inventory. Catalog, graph, DOT chart, and content
addresses are receiver outputs, not separate domain identity. Migrate imports
from `observeSoftwareEstate` to `inventorySoftware`, CLI calls from
`observe-software-estate` to `inventory-software`, and expected output kind
from `SoftwareEstateCircuitBundle` to `SoftwareInventory`.

The old local release remains immutable evidence. It is not republished or
silently replaced under the old name.
