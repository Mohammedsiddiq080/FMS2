from flask import Flask, render_template, request, jsonify, redirect, url_for, session
from pymongo import MongoClient
from datetime import datetime
from bson import ObjectId
import json
from functools import wraps

app = Flask(__name__)
app.secret_key = 'your_very_secret_key_here'

ADMIN_CREDENTIALS = {
    'username': 'admin',
    'password': 'admin123'
}

client = MongoClient('mongodb://localhost:27017/')
db = client['FleetManagementSystem']
drivers_collection = db['drivers']
fleet_collection = db['fleet']
spares_collection = db['spares']
assignments_collection = db['assignments']
billing_collection = db['billing']

class JSONEncoder(json.JSONEncoder):
    def default(self, o):
        if isinstance(o, ObjectId):
            return str(o)
        if isinstance(o, datetime):
            return o.isoformat()
        return json.JSONEncoder.default(self, o)

app.json_encoder = JSONEncoder

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'logged_in' not in session:
            return jsonify({'success': False, 'message': 'Please login first'}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route('/')
def index():
    if 'logged_in' in session:
        return redirect(url_for('dashboard'))
    return render_template('index.html')

@app.route('/login', methods=['POST'])
def login():
    username = request.form.get('username')
    password = request.form.get('password')

    if username == ADMIN_CREDENTIALS['username'] and password == ADMIN_CREDENTIALS['password']:
        session['logged_in'] = True
        session['username'] = username
        return jsonify({'success': True, 'redirect': url_for('dashboard'), 'message': 'Login successful'})

    return jsonify({'success': False, 'message': 'Invalid username or password'})

@app.route('/logout')
def logout():
    session.clear()
    return redirect(url_for('index'))

@app.route('/dashboard')
@login_required
def dashboard():
    counts = {
        'drivers': drivers_collection.count_documents({}),
        'fleet': fleet_collection.count_documents({}),
        'assignments': assignments_collection.count_documents({}),
        'billing': billing_collection.count_documents({}),
        'spares': spares_collection.count_documents({})
    }
    return render_template('dashboard.html', counts=counts)

@app.route('/driver', methods=['GET', 'POST'])
@login_required
def driver():
    if request.method == 'POST':
        try:
            last_driver = drivers_collection.find_one(sort=[("created_at", -1)])
            if last_driver and 'driver_id' in last_driver:
                last_id_num = int(last_driver['driver_id'].replace("DRIVER", ""))
                new_id_num = last_id_num + 1
            else:
                new_id_num = 1
            new_driver_id = f"DRIVER{new_id_num:03d}"

            driver_data = {
                'driver_id': new_driver_id,
                'first_name': request.form.get('first_name'),
                'last_name': request.form.get('last_name'),
                'license_number': request.form.get('license_number'),
                'created_at': datetime.now()
            }

            drivers_collection.insert_one(driver_data)
            return jsonify({'success': True, 'message': 'Driver saved successfully', 'driver_id': new_driver_id})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})
    return render_template('driver.html')

@app.route('/fleet', methods=['GET', 'POST'])
@login_required
def fleet():
    if request.method == 'POST':
        try:
            fleet_data = {
                'vehicle_id': request.form.get('vehicle_id'),
                'model': request.form.get('model'),
                'reg_no': request.form.get('reg_no'),
                'last_service': datetime.strptime(request.form.get('last_service'), '%Y-%m-%d'),
                'mileage': int(request.form.get('mileage')),
                'updated_at': datetime.now()
            }
            fleet_collection.insert_one(fleet_data)
            return jsonify({'success': True, 'message': 'Vehicle details saved successfully'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})
    return render_template('fleet.html')

@app.route('/get-next-assignment-id')
@login_required
def get_next_assignment_id():
    try:
        last_assignment = assignments_collection.find_one(sort=[("created_at", -1)])
        if last_assignment and 'assignment_id' in last_assignment:
            last_id_num = int(last_assignment['assignment_id'].replace("ASSIGN", ""))
            new_id_num = last_id_num + 1
        else:
            new_id_num = 1
        new_assignment_id = f"ASSIGN{new_id_num:03d}"
        return jsonify({'success': True, 'assignment_id': new_assignment_id})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/get-available-vehicles')
@login_required
def get_available_vehicles():
    try:
        assigned_vehicle_ids = [a['vehicle_id'] for a in assignments_collection.find(
            {'end_date': {'$gte': datetime.now()}},
            {'vehicle_id': 1}
        )]
        
        available_vehicles = list(fleet_collection.find(
            {'vehicle_id': {'$nin': assigned_vehicle_ids}}
        ))
        
        return jsonify({
            'success': True,
            'vehicles': available_vehicles
        })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)})

@app.route('/assignment', methods=['GET', 'POST'])
@login_required
def assignment():
    if request.method == 'POST':
        try:
            assignment_data = {
                'assignment_id': request.form.get('assignment_id'),
                'company_name': request.form.get('company_name'),
                'vehicle_id': request.form.get('vehicle_id'),
                'driver_id': request.form.get('driver_id'),
                'start_date': datetime.strptime(request.form.get('start_date'), '%Y-%m-%d'),
                'end_date': datetime.strptime(request.form.get('end_date'), '%Y-%m-%d'),
                'status': 'active',
                'created_at': datetime.now()
            }
            assignments_collection.insert_one(assignment_data)
            return jsonify({
                'success': True, 
                'message': 'Assignment saved successfully',
                'assignment_id': assignment_data['assignment_id']
            })
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})
    
    drivers = list(drivers_collection.find({}, {'driver_id': 1, 'first_name': 1, 'last_name': 1}))
    return render_template('assignment.html', drivers=drivers)

@app.route('/billing', methods=['GET', 'POST'])
@login_required
def billing():
    if request.method == 'POST':
        try:
            billing_data = {
                'record_id': request.form.get('record_id'),
                'vehicle_id': request.form.get('vehicle_id'),
                'assignment_id': request.form.get('assignment_id'),
                'km_before': int(request.form.get('km_before')),
                'km_after': int(request.form.get('km_after')),
                'charges_per_km': float(request.form.get('charges_per_km')),
                'gst': float(request.form.get('gst')),
                'created_at': datetime.now()
            }
            billing_collection.insert_one(billing_data)
            return jsonify({'success': True, 'message': 'Billing record saved successfully'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})
    return render_template('billing.html')

@app.route('/spares', methods=['GET', 'POST'])
@login_required
def spares():
    if request.method == 'POST':
        try:
            spares_data = {
                'spare_id': request.form.get('spare_id'),
                'vehicle_id': request.form.get('vehicle_id'),
                'part_name': request.form.get('part_name'),
                'quantity': int(request.form.get('quantity')),
                'created_at': datetime.now()
            }
            spares_collection.insert_one(spares_data)
            return jsonify({'success': True, 'message': 'Spare parts record saved successfully'})
        except Exception as e:
            return jsonify({'success': False, 'message': str(e)})
    return render_template('spares.html')

@app.route('/check-auth')
def check_auth():
    return jsonify({
        'logged_in': 'logged_in' in session,
        'username': session.get('username')
    })

if __name__ == '__main__':
    app.run(debug=True)
