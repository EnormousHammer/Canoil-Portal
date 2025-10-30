# Canoil Portal Frontend

This is the React frontend for the Canoil Portal application.

## Installation

1. Install dependencies:
   ```
   npm install
   ```

2. Start the development server:
   ```
   npm run dev
   ```

3. Access the application at `http://localhost:3000`

## Features

### Authentication
- Secure login with JWT authentication
- Role-based access control

### Manufacturing Orders (MO)
- Create, view, and manage manufacturing orders
- Track production progress from draft to completion
- Manage bill of materials (BOM) for each MO
- Close MO with lot traceability

### Lot Traceability
- Track genealogy of all lots
- View parent-child relationships between lots
- Trace lots back to raw materials
- Support for multiple consumption scenarios

### Sage 50 Integration
- Sync inventory data from Sage 50
- Sync purchase orders and sales orders
- Push finished lots from MOs to Sage 50
- View synchronization status

## Sage 50 Integration Usage

### Sync Dashboard
The Sage 50 Sync Dashboard provides a centralized view of:
- Sync status for inventory, POs, and SOs
- Last sync time and item counts
- Manual sync buttons for each data type
- Tabbed interface to view synced data

Access the dashboard at: `/sage`

### Pushing Finished Lots
Finished lots can be pushed to Sage 50 from multiple places:
1. From Manufacturing Order details page when an MO is closed
2. From Lot Details page for any lot
3. From the trace view when examining lot genealogy

Note: The item must already exist in Sage 50 for pushing lots to succeed.

## Development Notes

- The frontend communicates with the backend API running on `http://localhost:5000`
- Authentication tokens are stored in localStorage
- All Sage 50 operations happen server-side via the backend API 